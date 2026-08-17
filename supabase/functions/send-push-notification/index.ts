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
    const { notificationType, sessionId, targetUserIds } = await req.json();

    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      throw new Error("VAPID keys not configured in Edge Function environment");
    }

    // Determine payload based on notification type
    let payload = { title: "StatTracker", body: "You have a new notification." };
    
    if (notificationType === 'PAST_STATS') {
      payload = {
        title: "📊 Last Week's Stats",
        body: "Check out the top performers and scores from our last game!",
      };
    } else if (notificationType === 'UPCOMING_INFO') {
      payload = {
        title: "📅 Upcoming Match Scheduled!",
        body: "Tap to view your team and match details for tomorrow.",
      };
    } else if (notificationType === 'POST_MATCH') {
      payload = {
        title: "🏁 Match Completed!",
        body: "The final scores and awards are in. See how your team did!",
      };
    } else {
      // Fallback or custom push test
      payload = { title: "Test Notification", body: "This is a test web push." };
    }

    // For testing, we only want to send to Admins if no specific targetUserIds are passed
    // In production, targetUserIds would be the list of players involved in the session.
    let query = supabase.from('push_subscriptions').select('endpoint, p256dh, auth, user_id, profiles!inner(role)');
    
    // During testing phase (per implementation plan), strictly limit to admin
    // This can be changed later when ready for production.
    query = query.eq('profiles.role', 'admin');

    const { data: subscriptions, error } = await query;
    if (error) throw error;

    console.log(`Found ${subscriptions?.length || 0} subscriptions to notify.`);

    const sendPromises = subscriptions.map(async (sub) => {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        }
      };

      try {
        await webpush.sendNotification(pushSubscription, JSON.stringify(payload));
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

    return new Response(JSON.stringify({ success: true, results }), {
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
