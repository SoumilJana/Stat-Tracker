-- Migration: Position-based rating system and team stats tracking

-- 1. Add position ENUM and column
CREATE TYPE player_position AS ENUM ('FWD', 'MID', 'DEF', 'GK');
ALTER TABLE profiles ADD COLUMN position player_position DEFAULT 'FWD';

-- 2. Create session_team_stats table
CREATE TABLE session_team_stats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  wins INTEGER DEFAULT 0,
  matches_played INTEGER DEFAULT 0,
  goals_conceded INTEGER DEFAULT 0,
  UNIQUE(session_id, team_id)
);

ALTER TABLE session_team_stats ENABLE ROW LEVEL SECURITY;
GRANT ALL ON session_team_stats TO authenticated;
GRANT ALL ON session_team_stats TO anon;

CREATE POLICY "Anyone can read session_team_stats" ON session_team_stats FOR SELECT USING (true);
CREATE POLICY "Admins can insert session_team_stats" ON session_team_stats FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admins can update session_team_stats" ON session_team_stats FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 3. Update player_stats view to include wins, matches_played (mini-matches), and goals_conceded
DROP VIEW IF EXISTS player_stats;
CREATE OR REPLACE VIEW player_stats AS
SELECT 
  p.id AS player_id,
  p.username,
  p.full_name,
  p.role,
  p.position,
  p.photo_url,
  COALESCE(sc.sessions_played, 0) AS games_played, -- legacy field (sessions)
  COALESCE(ts.total_wins, 0) AS total_wins,
  COALESCE(ts.total_mini_matches, 0) AS total_mini_matches,
  COALESCE(ts.total_goals_conceded, 0) AS total_goals_conceded,
  COALESCE(g.total_goals, 0) AS total_goals,
  COALESCE(a.total_assists, 0) AS total_assists,
  COALESCE(d.best_defender_awards, 0) AS best_defender_awards,
  COALESCE(gk.best_gk_awards, 0) AS best_gk_awards
FROM 
  profiles p
LEFT JOIN (
  SELECT tp.player_id, COUNT(DISTINCT t.session_id) as sessions_played
  FROM team_players tp
  JOIN teams t ON tp.team_id = t.id
  JOIN sessions s ON t.session_id = s.id
  WHERE s.status = 'COMPLETED'
  GROUP BY tp.player_id
) sc ON p.id = sc.player_id
LEFT JOIN (
  SELECT 
    tp.player_id, 
    SUM(sts.wins) as total_wins,
    SUM(sts.matches_played) as total_mini_matches,
    SUM(sts.goals_conceded) as total_goals_conceded
  FROM team_players tp
  JOIN session_team_stats sts ON tp.team_id = sts.team_id
  JOIN sessions s ON sts.session_id = s.id
  WHERE s.status = 'COMPLETED'
  GROUP BY tp.player_id
) ts ON p.id = ts.player_id
LEFT JOIN (
  SELECT e.player_id, COUNT(e.id) as total_goals 
  FROM events e
  JOIN sessions s ON e.session_id = s.id
  WHERE e.event_type = 'GOAL' AND s.status = 'COMPLETED'
  GROUP BY e.player_id
) g ON p.id = g.player_id
LEFT JOIN (
  SELECT e.assisted_by as player_id, COUNT(e.id) as total_assists 
  FROM events e
  JOIN sessions s ON e.session_id = s.id
  WHERE e.event_type = 'GOAL' AND e.assisted_by IS NOT NULL AND s.status = 'COMPLETED'
  GROUP BY e.assisted_by
) a ON p.id = a.player_id
LEFT JOIN (
  SELECT candidate_id as player_id, COUNT(*) as best_defender_awards
  FROM match_awards_view
  WHERE award_type = 'BEST_DEFENDER'
  GROUP BY candidate_id
) d ON p.id = d.player_id
LEFT JOIN (
  SELECT candidate_id as player_id, COUNT(*) as best_gk_awards
  FROM match_awards_view
  WHERE award_type = 'BEST_GK'
  GROUP BY candidate_id
) gk ON p.id = gk.player_id;

GRANT SELECT ON player_stats TO authenticated;
GRANT SELECT ON player_stats TO anon;
