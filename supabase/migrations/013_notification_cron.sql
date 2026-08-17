-- Note: To run this, you must enable pg_cron and pg_net extensions in Supabase Dashboard.
-- You must also replace YOUR_SERVICE_ROLE_KEY with your actual service_role key.

create extension if not exists pg_net;
create extension if not exists pg_cron;

-- 1. Webhook for Post-Match (Trigger on sessions table when status changes to 'COMPLETED')
create or replace function public.handle_post_match_notification()
returns trigger as $$
begin
  if (old.status != 'COMPLETED' and new.status = 'COMPLETED') then
    perform net.http_post(
        url := 'https://knnctnedqwexbrfpeunc.supabase.co/functions/v1/send-push-notification',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
        ),
        body := jsonb_build_object(
            'notificationType', 'POST_MATCH',
            'sessionId', new.id
        )
    );
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_match_completed on public.sessions;
create trigger on_match_completed
  after update of status on public.sessions
  for each row
  execute function public.handle_post_match_notification();

-- 2. Cron Jobs for Pre-Match Notifications (6 PM and 9 PM)
-- Note: Supabase cron uses UTC timezone by default. If you are in IST (UTC+5:30), 
-- 6:00 PM IST is 12:30 PM UTC (30 12 * * *). 
-- 9:00 PM IST is 3:30 PM UTC (30 15 * * *).
-- Adjust the cron schedule according to your actual timezone.

-- 6:00 PM Notification (Past Stats)
select cron.schedule(
  'upcoming-match-stats',
  '30 12 * * *', -- 12:30 PM UTC = 6:00 PM IST
  $$
    select net.http_post(
        url := 'https://knnctnedqwexbrfpeunc.supabase.co/functions/v1/send-push-notification',
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'),
        body := jsonb_build_object('notificationType', 'PAST_STATS')
    );
  $$
);

-- 9:00 PM Notification (Upcoming Info)
select cron.schedule(
  'upcoming-match-info',
  '30 15 * * *', -- 3:30 PM UTC = 9:00 PM IST
  $$
    select net.http_post(
        url := 'https://knnctnedqwexbrfpeunc.supabase.co/functions/v1/send-push-notification',
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'),
        body := jsonb_build_object('notificationType', 'UPCOMING_INFO')
    );
  $$
);
