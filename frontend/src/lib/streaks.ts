import { supabase } from './supabase';

/**
 * Returns a Set of player_ids who are currently "On Fire"
 * A player is "On Fire" if they have scored 4 or more goals across the last 3 completed sessions.
 */
export async function getOnFirePlayers(): Promise<Set<string>> {
  try {
    // 1. Get the last 3 completed sessions
    const { data: recentSessions, error: sessionError } = await supabase
      .from('sessions')
      .select('id')
      .eq('status', 'COMPLETED')
      .order('date', { ascending: false })
      .limit(3);

    if (sessionError || !recentSessions || recentSessions.length === 0) {
      return new Set();
    }

    const sessionIds = recentSessions.map(s => s.id);

    // 2. Fetch all GOAL events from those sessions
    const { data: goalEvents, error: eventError } = await supabase
      .from('events')
      .select('player_id')
      .eq('event_type', 'GOAL')
      .in('session_id', sessionIds);

    if (eventError || !goalEvents) {
      return new Set();
    }

    // 3. Count goals per player
    const goalCounts: Record<string, number> = {};
    for (const event of goalEvents) {
      if (event.player_id) {
        goalCounts[event.player_id] = (goalCounts[event.player_id] || 0) + 1;
      }
    }

    // 4. Identify players with 4+ goals
    const onFirePlayers = new Set<string>();
    for (const [playerId, count] of Object.entries(goalCounts)) {
      if (count >= 4) {
        onFirePlayers.add(playerId);
      }
    }

    return onFirePlayers;
  } catch (err) {
    console.error('Error fetching on fire players:', err);
    return new Set();
  }
}
