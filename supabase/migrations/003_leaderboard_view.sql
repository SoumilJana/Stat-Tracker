-- Create a view to easily calculate player statistics (Leaderboard)
CREATE OR REPLACE VIEW player_stats AS
SELECT 
  p.id AS player_id,
  p.username,
  p.photo_url,
  COUNT(e.id) AS total_goals
FROM 
  profiles p
LEFT JOIN 
  events e ON p.id = e.player_id AND e.event_type = 'GOAL'
GROUP BY 
  p.id, p.username, p.photo_url;

-- Grant access to authenticated users
GRANT SELECT ON player_stats TO authenticated;
GRANT SELECT ON player_stats TO anon;
