ALTER TYPE award_type ADD VALUE IF NOT EXISTS 'MOTM';

DROP VIEW IF EXISTS player_stats;

CREATE OR REPLACE VIEW player_stats AS
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
