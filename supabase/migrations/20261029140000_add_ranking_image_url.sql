-- Migration: Add ranking_image_url to profiles and update player_stats view and update_profile_data RPC

-- 1. Add ranking_image_url column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ranking_image_url TEXT;

-- 2. Update player_stats view to include ranking_image_url
DROP VIEW IF EXISTS player_stats;

CREATE OR REPLACE VIEW player_stats AS
SELECT 
  p.id AS player_id,
  p.username,
  p.full_name,
  p.role,
  p.position,
  p.photo_url,
  p.ranking_image_url,
  COALESCE(sc.games_played, 0) AS games_played,
  COALESCE(ts.total_wins, 0) AS total_wins,
  COALESCE(ts.total_mini_matches, 0) AS total_mini_matches,
  COALESCE(ts.total_goals_conceded, 0) AS total_goals_conceded,
  COALESCE(g.total_goals, 0) AS total_goals,
  COALESCE(a.total_assists, 0) AS total_assists,
  COALESCE(d.best_defender_awards, 0) AS best_defender_awards,
  COALESCE(gk.best_gk_awards, 0) AS best_gk_awards,
  COALESCE(motm.motm_awards, 0) AS motm_awards
FROM 
  profiles p
LEFT JOIN (
  SELECT tp.player_id, COUNT(DISTINCT t.session_id) as games_played
  FROM team_players tp
  JOIN teams t ON tp.team_id = t.id
  JOIN sessions s ON t.session_id = s.id
  WHERE s.status = 'COMPLETED'
  GROUP BY tp.player_id
) sc ON p.id = sc.player_id
LEFT JOIN (
  WITH session_winners AS (
    SELECT session_id, MAX(wins) as max_wins
    FROM session_team_stats
    GROUP BY session_id
  )
  SELECT 
    tp.player_id, 
    COUNT(DISTINCT CASE WHEN sts.wins = sw.max_wins AND sw.max_wins > 0 THEN sts.session_id END) as total_wins,
    SUM(sts.matches_played) as total_mini_matches,
    SUM(sts.goals_conceded) as total_goals_conceded
  FROM team_players tp
  JOIN session_team_stats sts ON tp.team_id = sts.team_id
  JOIN sessions s ON sts.session_id = s.id
  JOIN session_winners sw ON sts.session_id = sw.session_id
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
) gk ON p.id = gk.player_id
LEFT JOIN (
  SELECT candidate_id as player_id, COUNT(*) as motm_awards
  FROM match_awards_view
  WHERE award_type = 'MOTM'
  GROUP BY candidate_id
) motm ON p.id = motm.player_id;

GRANT SELECT ON player_stats TO authenticated;
GRANT SELECT ON player_stats TO anon;

-- 3. Update update_profile_data RPC with ranking_image_url
CREATE OR REPLACE FUNCTION update_profile_data(
  p_user_id UUID,
  p_username TEXT,
  p_full_name TEXT,
  p_photo_url TEXT,
  p_position player_position DEFAULT 'FWD'::player_position,
  p_ranking_image_url TEXT DEFAULT NULL
) RETURNS void AS $$
BEGIN
  -- Check authorization: user is updating themselves OR user is an admin
  IF auth.uid() = p_user_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
    UPDATE profiles
    SET username = p_username,
        full_name = p_full_name,
        photo_url = p_photo_url,
        position = p_position,
        ranking_image_url = p_ranking_image_url
    WHERE id = p_user_id;
  ELSE
    RAISE EXCEPTION 'Not authorized to update this profile';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
