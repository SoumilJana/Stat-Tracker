-- Migration: Add is_own_goal column and update player_stats view & get_player_stats_in_range RPC
-- Milestone: Own Goals Support in StatTracker

-- 1. Add is_own_goal column to events table
ALTER TABLE events
ADD COLUMN IF NOT EXISTS is_own_goal BOOLEAN DEFAULT FALSE;

-- 2. Update player_stats view to exclude own goals from total_goals
DROP VIEW IF EXISTS player_stats;

CREATE OR REPLACE VIEW player_stats AS
SELECT 
  p.id AS player_id,
  p.username,
  p.full_name,
  p.role,
  p.position,
  p.photo_url,
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
  WHERE e.event_type = 'GOAL' 
    AND (e.is_own_goal IS FALSE OR e.is_own_goal IS NULL)
    AND s.status = 'COMPLETED'
  GROUP BY e.player_id
) g ON p.id = g.player_id
LEFT JOIN (
  SELECT e.assisted_by as player_id, COUNT(e.id) as total_assists 
  FROM events e
  JOIN sessions s ON e.session_id = s.id
  WHERE e.event_type = 'GOAL' 
    AND (e.is_own_goal IS FALSE OR e.is_own_goal IS NULL)
    AND e.assisted_by IS NOT NULL 
    AND s.status = 'COMPLETED'
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

-- 3. Update get_player_stats_in_range RPC function
DROP FUNCTION IF EXISTS get_player_stats_in_range(TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE);

CREATE FUNCTION get_player_stats_in_range(
  p_start_date TIMESTAMP WITH TIME ZONE,
  p_end_date   TIMESTAMP WITH TIME ZONE
)
RETURNS TABLE (
  player_id            UUID,
  matches_played       BIGINT,
  goals                BIGINT,
  assists              BIGINT,
  wins                 BIGINT,
  losses               BIGINT,
  draws                BIGINT,
  best_defender_awards BIGINT,
  best_gk_awards       BIGINT
) LANGUAGE sql SECURITY DEFINER AS
$$
  WITH
  vs AS (
    SELECT id FROM sessions
    WHERE status = 'COMPLETED'
      AND date >= p_start_date
      AND (p_end_date IS NULL OR date < p_end_date)
  ),
  sp AS (
    SELECT DISTINCT tp.player_id, t.id AS team_id, t.session_id
    FROM teams t
    JOIN team_players tp ON tp.team_id = t.id
    WHERE t.session_id IN (SELECT id FROM vs)
  ),
  aw AS (
    WITH ranked AS (
      SELECT
        pv.candidate_id,
        pv.award_type,
        ROW_NUMBER() OVER (
          PARTITION BY pv.session_id, pv.award_type
          ORDER BY COUNT(*) DESC, pv.candidate_id ASC
        ) AS rnk
      FROM poll_votes pv
      WHERE pv.session_id IN (SELECT id FROM vs)
      GROUP BY pv.session_id, pv.award_type, pv.candidate_id
    )
    SELECT candidate_id, award_type FROM ranked WHERE rnk = 1
  ),
  ap AS (SELECT DISTINCT player_id FROM sp)
  SELECT
    ap.player_id,
    (SELECT COUNT(DISTINCT sp2.session_id) FROM sp sp2 WHERE sp2.player_id = ap.player_id)::BIGINT AS matches_played,
    (SELECT COUNT(*) FROM events e WHERE e.session_id IN (SELECT id FROM vs) AND e.player_id = ap.player_id AND e.event_type = 'GOAL' AND (e.is_own_goal IS FALSE OR e.is_own_goal IS NULL))::BIGINT AS goals,
    (SELECT COUNT(*) FROM events e WHERE e.session_id IN (SELECT id FROM vs) AND e.assisted_by = ap.player_id AND e.event_type = 'GOAL' AND (e.is_own_goal IS FALSE OR e.is_own_goal IS NULL))::BIGINT AS assists,
    COALESCE((SELECT SUM(sts.wins) FROM sp sp2 JOIN session_team_stats sts ON sts.session_id = sp2.session_id AND sts.team_id = sp2.team_id WHERE sp2.player_id = ap.player_id), 0)::BIGINT AS wins,
    COALESCE((SELECT SUM(sts.matches_played - sts.wins) FROM sp sp2 JOIN session_team_stats sts ON sts.session_id = sp2.session_id AND sts.team_id = sp2.team_id WHERE sp2.player_id = ap.player_id), 0)::BIGINT AS losses,
    0::BIGINT AS draws,
    COALESCE((SELECT COUNT(*) FROM aw WHERE aw.candidate_id = ap.player_id AND aw.award_type = 'BEST_DEFENDER'), 0)::BIGINT AS best_defender_awards,
    COALESCE((SELECT COUNT(*) FROM aw WHERE aw.candidate_id = ap.player_id AND aw.award_type = 'BEST_GK'), 0)::BIGINT AS best_gk_awards
  FROM ap;
$$;
