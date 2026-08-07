-- 1. Add SCHEDULED to session_status
ALTER TYPE session_status ADD VALUE IF NOT EXISTS 'SCHEDULED' BEFORE 'IN_PROGRESS';

-- Update sessions default
ALTER TABLE sessions ALTER COLUMN status SET DEFAULT 'SCHEDULED';

-- 2. Update player_stats view to ONLY count COMPLETED matches
DROP VIEW IF EXISTS player_stats;

CREATE OR REPLACE VIEW player_stats AS
SELECT 
  p.id,
  p.username,
  p.full_name,
  p.role,
  p.photo_url,
  -- Only count goals that occurred in COMPLETED sessions
  COUNT(DISTINCT CASE WHEN s.status = 'COMPLETED' AND e.event_type = 'GOAL' THEN e.id ELSE NULL END) AS total_goals,
  -- Only count distinct sessions that are COMPLETED
  COUNT(DISTINCT CASE WHEN s.status = 'COMPLETED' THEN t.session_id ELSE NULL END) AS games_played
FROM 
  profiles p
LEFT JOIN 
  team_players tp ON p.id = tp.player_id
LEFT JOIN
  teams t ON tp.team_id = t.id
LEFT JOIN 
  sessions s ON t.session_id = s.id
LEFT JOIN 
  events e ON p.id = e.player_id AND e.session_id = s.id
GROUP BY 
  p.id, p.username, p.full_name, p.role, p.photo_url;

-- Grant access
GRANT SELECT ON player_stats TO authenticated;
GRANT SELECT ON player_stats TO anon;
