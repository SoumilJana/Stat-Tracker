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
    const { notificationType, sessionId, targetUserIds, timeZone: requestedTimeZone } = await req.json();

    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      throw new Error("VAPID keys not configured in Edge Function environment");
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
