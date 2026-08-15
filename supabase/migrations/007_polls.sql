CREATE TYPE award_type AS ENUM ('BEST_DEFENDER', 'BEST_GK');

CREATE TABLE poll_votes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  award_type award_type NOT NULL,
  voter_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  candidate_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(session_id, award_type, voter_id)
);

ALTER TABLE poll_votes ENABLE ROW LEVEL SECURITY;

-- Anyone can read
CREATE POLICY "Poll votes are viewable by everyone." ON poll_votes FOR SELECT USING (true);
-- Authenticated users can insert their own vote
CREATE POLICY "Users can insert their own votes." ON poll_votes FOR INSERT WITH CHECK (auth.uid() = voter_id);
-- Authenticated users can update their own vote
CREATE POLICY "Users can update their own votes." ON poll_votes FOR UPDATE USING (auth.uid() = voter_id);

-- Dynamic View to calculate winners for each match
CREATE OR REPLACE VIEW match_awards_view AS
WITH ranked_candidates AS (
  SELECT 
    session_id,
    award_type,
    candidate_id,
    COUNT(*) as votes,
    ROW_NUMBER() OVER (PARTITION BY session_id, award_type ORDER BY COUNT(*) DESC, candidate_id ASC) as rank
  FROM poll_votes
  GROUP BY session_id, award_type, candidate_id
)
SELECT session_id, award_type, candidate_id, votes
FROM ranked_candidates
WHERE rank = 1;

-- Update player_stats view
DROP VIEW IF EXISTS player_stats;

CREATE OR REPLACE VIEW player_stats AS
WITH session_counts AS (
  SELECT tp.player_id, COUNT(DISTINCT t.session_id) as games_played
  FROM team_players tp
  JOIN teams t ON tp.team_id = t.id
  JOIN sessions s ON t.session_id = s.id
  WHERE s.status = 'COMPLETED'
  GROUP BY tp.player_id
),
goal_counts AS (
  SELECT e.player_id, COUNT(e.id) as total_goals 
  FROM events e
  JOIN sessions s ON e.session_id = s.id
  WHERE e.event_type = 'GOAL' AND s.status = 'COMPLETED'
  GROUP BY e.player_id
),
assist_counts AS (
  SELECT e.assisted_by as player_id, COUNT(e.id) as total_assists 
  FROM events e
  JOIN sessions s ON e.session_id = s.id
  WHERE e.event_type = 'GOAL' AND e.assisted_by IS NOT NULL AND s.status = 'COMPLETED'
  GROUP BY e.assisted_by
),
defender_counts AS (
  SELECT candidate_id as player_id, COUNT(*) as best_defender_awards
  FROM match_awards_view
  WHERE award_type = 'BEST_DEFENDER'
  GROUP BY candidate_id
),
gk_counts AS (
  SELECT candidate_id as player_id, COUNT(*) as best_gk_awards
  FROM match_awards_view
  WHERE award_type = 'BEST_GK'
  GROUP BY candidate_id
)
SELECT 
  p.id AS player_id,
  p.username,
  p.full_name,
  p.role,
  p.photo_url,
  COALESCE(sc.games_played, 0) AS games_played,
  COALESCE(g.total_goals, 0) AS total_goals,
  COALESCE(a.total_assists, 0) AS total_assists,
  COALESCE(d.best_defender_awards, 0) AS best_defender_awards,
  COALESCE(gk.best_gk_awards, 0) AS best_gk_awards
FROM 
  profiles p
LEFT JOIN session_counts sc ON p.id = sc.player_id
LEFT JOIN goal_counts g ON p.id = g.player_id
LEFT JOIN assist_counts a ON p.id = a.player_id
LEFT JOIN defender_counts d ON p.id = d.player_id
LEFT JOIN gk_counts gk ON p.id = gk.player_id;

GRANT SELECT ON match_awards_view TO authenticated;
GRANT SELECT ON match_awards_view TO anon;
GRANT SELECT ON player_stats TO authenticated;
GRANT SELECT ON player_stats TO anon;
