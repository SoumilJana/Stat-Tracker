-- Add assisted_by column
ALTER TABLE events
ADD COLUMN IF NOT EXISTS assisted_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Recreate the player_stats view to include games_played and only count completed sessions
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
)
SELECT 
  p.id AS player_id,
  p.username,
  p.full_name,
  p.role,
  p.photo_url,
  COALESCE(sc.games_played, 0) AS games_played,
  COALESCE(g.total_goals, 0) AS total_goals,
  COALESCE(a.total_assists, 0) AS total_assists
FROM 
  profiles p
LEFT JOIN session_counts sc ON p.id = sc.player_id
LEFT JOIN goal_counts g ON p.id = g.player_id
LEFT JOIN assist_counts a ON p.id = a.player_id;

-- Grant access to authenticated and anon users
GRANT SELECT ON player_stats TO authenticated;
GRANT SELECT ON player_stats TO anon;
