import { supabase } from './supabase';

/**
 * Returns a Set of player_ids who are currently "On Fire"
 * A player is "On Fire" if they have scored 3 or more goals in EACH of the last 2 completed sessions globally.
 * (If they miss a session, they score 0, and lose the streak).
 */
export async function getOnFirePlayers(): Promise<Set<string>> {
  try {
    // 1. Get the last 2 completed sessions
    const { data: recentSessions, error: sessionError } = await supabase
      .from('sessions')
      .select('id')
      .eq('status', 'COMPLETED')
      .order('date', { ascending: false })
      .limit(2);

    if (sessionError || !recentSessions || recentSessions.length < 2) {
      return new Set();
    }

    const sessionIds = recentSessions.map(s => s.id);

    // 2. Fetch all GOAL events from those sessions
    const { data: goalEvents, error: eventError } = await supabase
      .from('events')
      .select('player_id, session_id')
      .eq('event_type', 'GOAL')
      .in('session_id', sessionIds);

    if (eventError || !goalEvents) {
      return new Set();
    }

    // 3. Count goals per player per session
    const playerSessionGoals: Record<string, Record<string, number>> = {};
    for (const event of goalEvents) {
      if (event.player_id && event.session_id) {
        if (!playerSessionGoals[event.player_id]) {
          playerSessionGoals[event.player_id] = {};
        }
        playerSessionGoals[event.player_id][event.session_id] = 
          (playerSessionGoals[event.player_id][event.session_id] || 0) + 1;
      }
    }

    // 4. Identify players with 3+ goals in ALL of the last 2 sessions
    const onFirePlayers = new Set<string>();
    for (const [playerId, sessionCounts] of Object.entries(playerSessionGoals)) {
      let qualifies = true;
      for (const sessionId of sessionIds) {
        if ((sessionCounts[sessionId] || 0) < 3) {
          qualifies = false;
          break;
        }
      }
      if (qualifies) {
        onFirePlayers.add(playerId);
      }
    }

    return onFirePlayers;
  } catch (err) {
    console.error('Error fetching on fire players:', err);
    return new Set();
  }
}
