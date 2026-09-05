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
  best_defender_awards BIGINT,
  best_gk_awards       BIGINT
) LANGUAGE sql SECURITY DEFINER AS
$$
  WITH
  -- Sessions in range
  vs AS (
    SELECT id FROM sessions
    WHERE status = 'COMPLETED'
      AND date >= p_start_date
      AND (p_end_date IS NULL OR date < p_end_date)
  ),
  -- Players in those sessions via teams + team_players
  sp AS (
    SELECT DISTINCT tp.player_id, t.id AS team_id, t.session_id
    FROM teams t
    JOIN team_players tp ON tp.team_id = t.id
    WHERE t.session_id IN (SELECT id FROM vs)
  ),
  -- Award winners per session (majority-vote)
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
  -- Unique players
  ap AS (SELECT DISTINCT player_id FROM sp)
  SELECT
    ap.player_id,
    (SELECT COUNT(DISTINCT sp2.session_id) FROM sp sp2 WHERE sp2.player_id = ap.player_id)::BIGINT AS matches_played,
    (SELECT COUNT(*) FROM events e WHERE e.session_id IN (SELECT id FROM vs) AND e.player_id = ap.player_id AND e.event_type = 'GOAL')::BIGINT AS goals,
    (SELECT COUNT(*) FROM events e WHERE e.session_id IN (SELECT id FROM vs) AND e.assisted_by = ap.player_id AND e.event_type = 'GOAL')::BIGINT AS assists,
    COALESCE((SELECT SUM(sts.wins) FROM sp sp2 JOIN session_team_stats sts ON sts.session_id = sp2.session_id AND sts.team_id = sp2.team_id WHERE sp2.player_id = ap.player_id), 0)::BIGINT AS wins,
    COALESCE((SELECT COUNT(*) FROM aw WHERE aw.candidate_id = ap.player_id AND aw.award_type = 'BEST_DEFENDER'), 0)::BIGINT AS best_defender_awards,
    COALESCE((SELECT COUNT(*) FROM aw WHERE aw.candidate_id = ap.player_id AND aw.award_type = 'BEST_GK'), 0)::BIGINT AS best_gk_awards
  FROM ap;
$$;