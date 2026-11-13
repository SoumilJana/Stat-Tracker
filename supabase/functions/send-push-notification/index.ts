import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.112.2"
import webpush from "https://esm.sh/web-push@3.6.7"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") as string;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") as string;

// Set VAPID details
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY");
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY");

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    "mailto:support@stattracker.com",
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const ICON = '/pwa-192x192.png';
const BADGE = '/notification-badge.png';

// Format a game's wall-clock date/time, e.g. "Sat, 14 Nov · 7:00 AM"
function formatGameSlot(gameDate: string, startTime: string): string {
  const d = new Date(`${gameDate}T${(startTime || '00:00').slice(0, 5)}:00Z`);
  const day = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'UTC' });
  return `${day} · ${time}`;
}

// Only admins may trigger payment/roster notifications
async function requireAdmin(req: Request): Promise<void> {
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) throw new Error('Unauthorized');
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') throw new Error('Only admins can send this notification');
}

// Send a per-user payload to every push subscription of those users
async function sendToUsers(payloadByUser: Map<string, Record<string, unknown>>) {
  const userIds = [...payloadByUser.keys()];
  if (userIds.length === 0) return [];
  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth, user_id')
    .in('user_id', userIds);
  if (error) throw error;

  return Promise.all((subs || []).map(async (sub) => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payloadByUser.get(sub.user_id))
      );
      return { success: true, endpoint: sub.endpoint };
    } catch (err: any) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
      }
      return { success: false, endpoint: sub.endpoint, error: err.message };
    }
  }));
}

// PAYMENT_VERIFIED: tell the payer their spot is secured
async function handlePaymentVerified(paymentId: string) {
  const { data: payment } = await supabase
    .from('game_payments')
    .select('user_id, status, game:games(game_date, start_time, location)')
    .eq('id', paymentId)
    .single();
  if (!payment || payment.status !== 'VERIFIED') throw new Error('Payment not found or not verified');

  const game: any = payment.game;
  const where = game.location ? ` at ${game.location}` : '';
  const payloads = new Map<string, Record<string, unknown>>([[payment.user_id, {
    title: '✅ Payment verified',
    body: `You're locked in for ${formatGameSlot(game.game_date, game.start_time)}${where}. See you there!`,
    icon: ICON, badge: BADGE, url: '/payments'
  }]]);
  return sendToUsers(payloads);
}

// ROSTER_CONFIRMED: tell the confirmed squad, and let unconfirmed IN players know
async function handleRosterConfirmed(gameId: string) {
  const { data: game } = await supabase
    .from('games')
    .select('id, game_date, start_time, location, status, mode')
    .eq('id', gameId)
    .single();
  if (!game || game.status !== 'ROSTER_CONFIRMED') throw new Error('Game not found or roster not confirmed');

  const [{ data: regs }, { data: pays }] = await Promise.all([
    supabase.from('game_registrations').select('user_id').eq('game_id', gameId).eq('response', 'IN'),
    supabase.from('game_payments').select('user_id, status').eq('game_id', gameId)
  ]);
  const verified = new Set((pays || []).filter((p) => p.status === 'VERIFIED').map((p) => p.user_id));
  const slot = formatGameSlot(game.game_date, game.start_time);
  const where = game.location ? ` at ${game.location}` : '';
  const squadSize = (regs || []).filter((r) => verified.has(r.user_id)).length;
  const modeText = game.mode === 'WINNER_STAYS' ? '3 Teams Winner Stays' : `${squadSize}-player squad`;

  const payloads = new Map<string, Record<string, unknown>>();
  for (const r of regs || []) {
    payloads.set(r.user_id, verified.has(r.user_id)
      ? { title: '🔒 Roster confirmed', body: `You're in! ${modeText} · ${slot}${where}.`, icon: ICON, badge: BADGE, url: '/payments' }
      : { title: 'Roster confirmed', body: `The squad for ${slot} is locked. You're on the waiting list in case a spot opens.`, icon: ICON, badge: BADGE, url: '/payments' });
  }
  return sendToUsers(payloads);
}

// Caller must be signed in; returns their id and whether they are an admin
async function getCaller(req: Request): Promise<{ id: string; isAdmin: boolean }> {
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) throw new Error('Unauthorized');
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  return { id: user.id, isAdmin: profile?.role === 'admin' };
}

// PLAYER_DROPPED: tell admins who left (and any refund owed), and tell anyone
// who just moved from the waiting list into the squad. Sent by the player who
// tapped OUT, or by the admin who removed them.
async function handlePlayerDropped(
  caller: { id: string; isAdmin: boolean },
  gameId: string,
  droppedUserId: string,
  promotedUserIds: unknown
) {
  if (!gameId || !droppedUserId) throw new Error('gameId and droppedUserId are required');
  if (!caller.isAdmin && caller.id !== droppedUserId) throw new Error('Not allowed to send this notification');

  const [{ data: game }, { data: reg }, { data: payment }] = await Promise.all([
    supabase.from('games').select('id, game_date, start_time, location, status').eq('id', gameId).single(),
    supabase.from('game_registrations').select('response, updated_at').eq('game_id', gameId).eq('user_id', droppedUserId).single(),
    supabase.from('game_payments').select('status, amount').eq('game_id', gameId).eq('user_id', droppedUserId).maybeSingle()
  ]);
  if (!game) throw new Error('Game not found');
  // Only for a dropout that just happened
  if (!reg || reg.response !== 'OUT' || Date.now() - new Date(reg.updated_at).getTime() > 10 * 60 * 1000) {
    throw new Error('No recent dropout for this player');
  }

  // Only notify promoted players who really are in the squad now
  const { data: squad } = await supabase.rpc('game_squad_user_ids', { p_game_id: gameId });
  const squadSet = new Set<string>((squad as string[]) || []);
  const promoted = (Array.isArray(promotedUserIds) ? promotedUserIds : [])
    .filter((id): id is string => typeof id === 'string' && squadSet.has(id) && id !== droppedUserId);

  const { data: people } = await supabase
    .from('profiles')
    .select('id, username, role')
    .or(`role.eq.admin,id.in.(${[droppedUserId, ...promoted].join(',')})`);
  const nameOf = (id: string) => people?.find((p) => p.id === id)?.username || 'A player';
  const admins = (people || []).filter((p) => p.role === 'admin' && p.id !== caller.id);

  const slot = formatGameSlot(game.game_date, game.start_time);
  const promotedText = promoted.length > 0
    ? `${promoted.map(nameOf).join(', ')} moved into the squad.`
    : 'No one was on the waiting list.';
  const refundText = payment?.status === 'REFUND_PENDING' ? ` Refund ₹${Number(payment.amount).toFixed(0)} pending.` : '';
  const removedBy = caller.isAdmin && caller.id !== droppedUserId ? ' was removed' : ' dropped out';

  const payloads = new Map<string, Record<string, unknown>>();
  for (const a of admins) {
    payloads.set(a.id, {
      title: `🚪 ${nameOf(droppedUserId)}${removedBy}`,
      body: `${slot}: ${promotedText}${refundText}`,
      icon: ICON, badge: BADGE, url: '/payments'
    });
  }
  for (const id of promoted) {
    payloads.set(id, {
      title: "🎉 You're in the squad!",
      body: `A spot opened for ${slot}${game.location ? ` at ${game.location}` : ''}. Payment is now unlocked.`,
      icon: ICON, badge: BADGE, url: '/payments'
    });
  }
  return sendToUsers(payloads);
}

serve(async (req) => {
  // CORS Headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { notificationType, sessionId, targetUserIds, timeZone: requestedTimeZone, paymentId, gameId, droppedUserId, promotedUserIds } = await req.json();

    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      throw new Error("VAPID keys not configured in Edge Function environment");
    }

    if (notificationType === 'PLAYER_DROPPED') {
      const caller = await getCaller(req);
      const results = await handlePlayerDropped(caller, gameId, droppedUserId, promotedUserIds);
      return new Response(JSON.stringify({ success: true, results }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    if (notificationType === 'PAYMENT_VERIFIED' || notificationType === 'ROSTER_CONFIRMED') {
      await requireAdmin(req);
      const results = notificationType === 'PAYMENT_VERIFIED'
        ? await handlePaymentVerified(paymentId)
        : await handleRosterConfirmed(gameId);
      return new Response(JSON.stringify({ success: true, results }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    let globalPayload: any = null;
    let targetSessionId = sessionId;

    if (notificationType === 'PAST_STATS' || notificationType === 'POST_MATCH') {
      // Fetch latest completed session or specific session
      let sessionQuery = supabase
        .from('sessions')
        .select(`
          id,
          date,
          teams (
            id,
            name,
            team_players (
              player_id,
              profiles:profiles!team_players_player_id_fkey(username)
            )
          )
        `)
        .eq('status', 'COMPLETED');
        
      if (targetSessionId) {
        sessionQuery = sessionQuery.eq('id', targetSessionId);
      } else {
        sessionQuery = sessionQuery.order('date', { ascending: false }).limit(1);
      }

      const { data: latestSession } = await sessionQuery.single();

      if (latestSession) {
        // Fetch goals for this session
        const { data: events } = await supabase
          .from('events')
          .select('team_id, player_id, profiles!events_player_id_fkey(username)')
          .eq('session_id', latestSession.id)
          .eq('event_type', 'GOAL');
        
        let teamScores: Record<string, number> = {};
        latestSession.teams.forEach((t: any) => teamScores[t.name] = 0);
        
        let playerGoals: Record<string, number> = {};
        
        if (events) {
          events.forEach((e: any) => {
            const team = latestSession.teams.find((t: any) => t.id === e.team_id);
            if (team) {
              teamScores[team.name]++;
            }
            if (e.profiles?.username) {
              playerGoals[e.profiles.username] = (playerGoals[e.profiles.username] || 0) + 1;
            }
          });
        }
        
        if (notificationType === 'POST_MATCH') {
            let winningTeam = null;
            let maxScore = -1;
            let isDraw = false;

            Object.entries(teamScores).forEach(([name, score]) => {
                if (score > maxScore) {
                    maxScore = score;
                    winningTeam = latestSession.teams.find((t: any) => t.name === name);
                    isDraw = false;
                } else if (score === maxScore) {
                    isDraw = true;
                }
            });

            if (isDraw || !winningTeam) {
                globalPayload = {
                    title: "🏁 Match Ended!",
                    body: `It's a draw! Final score: ${Object.values(teamScores).join(' - ')}`,
                    icon: '/pwa-192x192.png',
                    badge: '/notification-badge.png',
                    url: '/'
                };
            } else {
                const playerNames = winningTeam.team_players.map((tp: any) => tp.profiles?.username || 'Unknown').join(', ');
                globalPayload = {
                    title: "🏁 Match Ended!",
                    body: `Winner: ${winningTeam.name} (${maxScore} goals)\nTeam: ${playerNames}`,
                    icon: '/pwa-192x192.png',
                    badge: '/notification-badge.png',
                    url: '/'
                };
            }
        } else {
            // PAST_STATS logic
            const scoreText = Object.entries(teamScores).map(([name, score]) => `${name}: ${score}`).join(' vs ');
            const topScorer = Object.entries(playerGoals).sort((a, b) => b[1] - a[1])[0];
            const topScorerText = topScorer ? ` | Top Scorer: ${topScorer[0]} (${topScorer[1]}⚽)` : '';

            globalPayload = {
              title: "📊 Last Match Stats",
              body: `${scoreText}${topScorerText}`,
              icon: '/pwa-192x192.png',
              badge: '/notification-badge.png',
              url: '/'
            };
        }
      } else {
        globalPayload = {
          title: notificationType === 'POST_MATCH' ? "🏁 Match Completed!" : "📊 Last Match Stats",
          body: "No past games found yet!",
          icon: '/pwa-192x192.png',
          badge: '/notification-badge.png',
          url: '/'
        };
      }
    } else if (notificationType === 'UPCOMING_INFO' || notificationType === 'MATCH_CREATED') {
      // Will be processed per user
    } else {
      // Fallback or custom push test
      globalPayload = {
        title: "Test Notification",
        body: "This is a test web push.",
        icon: '/pwa-192x192.png',
        badge: '/notification-badge.png',
        url: '/'
      };
    }

    let query = supabase.from('push_subscriptions').select('endpoint, p256dh, auth, user_id, profiles!inner(role)');
    
    // If specific target users are provided, filter to them; otherwise send to all subscribers
    if (targetUserIds && Array.isArray(targetUserIds) && targetUserIds.length > 0) {
      query = query.in('user_id', targetUserIds);
    }

    const { data: subscriptions, error } = await query;
    if (error) throw error;

    console.log(`Found ${subscriptions?.length || 0} subscriptions to notify.`);

    // Fetch the scheduled session details if needed for personalized notifications
    let scheduledSession: any = null;
    if (notificationType === 'UPCOMING_INFO' || notificationType === 'MATCH_CREATED') {
      let sessionQuery = supabase
        .from('sessions')
        .select(`
          id,
          date,
          location,
          teams (
            id,
            name,
            team_players (
              player_id,
              profiles:profiles!team_players_player_id_fkey(username)
            )
          )
        `);
      
      if (targetSessionId) {
        sessionQuery = sessionQuery.eq('id', targetSessionId);
      } else {
        sessionQuery = sessionQuery.eq('status', 'SCHEDULED').order('date', { ascending: false }).limit(1);
      }
      
      const { data } = await sessionQuery.single();
      scheduledSession = data;
    }

    const sendPromises = subscriptions.map(async (sub) => {
      let personalizedPayload = globalPayload;

      // Generate personalized payload for UPCOMING_INFO and MATCH_CREATED
      if (!globalPayload && scheduledSession) {
        // Format date: e.g., "September 12 at 7:00 AM"
        const timeZone = requestedTimeZone || Deno.env.get("TIMEZONE") || 'Asia/Kolkata';
        const d = new Date(scheduledSession.date);
        const dateStr = d.toLocaleString('en-US', {
          timeZone,
          day: 'numeric',
          month: 'long',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });
        const locationStr = scheduledSession.location ? `\n📍 ${scheduledSession.location}` : "";
        
        let teamInfo = "\n\nYou haven't been assigned to a team yet.";
        
        // Find which team this user is on
        let userTeam = null;
        for (const team of scheduledSession.teams) {
          const isPlayerInTeam = team.team_players.some((tp: any) => tp.player_id === sub.user_id);
          if (isPlayerInTeam) {
            userTeam = team;
            break;
          }
        }

        if (userTeam) {
          const playerNames = userTeam.team_players.map((tp: any) => tp.profiles?.username || 'Unknown').join(' · ');
          teamInfo = `\n\nYour Team (${userTeam.name}):\n${playerNames}`;
        }

        const titleStr = notificationType === 'MATCH_CREATED' ? "✅ Match Finalized & Scheduled!" : "📅 Upcoming Match Scheduled!";

        personalizedPayload = {
          title: titleStr,
          body: `📅 ${dateStr}${locationStr}${teamInfo}`,
          icon: '/pwa-192x192.png',
          badge: '/notification-badge.png',
          url: '/'
        };
      } else if (!globalPayload && !scheduledSession) {
        personalizedPayload = {
          title: "📅 Upcoming Match",
          body: "No scheduled matches found.",
          icon: '/pwa-192x192.png',
          badge: '/notification-badge.png',
          url: '/'
        };
      }

      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        }
      };

      try {
        await webpush.sendNotification(pushSubscription, JSON.stringify(personalizedPayload));
        return { success: true, endpoint: sub.endpoint };
      } catch (err: any) {
        console.error("Error sending push to endpoint", sub.endpoint, err);
        // If subscription is invalid/expired, remove it
        if (err.statusCode === 410 || err.statusCode === 404) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
        }
        return { success: false, endpoint: sub.endpoint, error: err.message };
      }
    });

    const results = await Promise.all(sendPromises);

    return new Response(JSON.stringify({ success: true, globalPayload, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: any) {
    console.error("Function error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
