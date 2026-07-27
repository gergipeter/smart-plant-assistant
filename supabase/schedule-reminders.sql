-- Schedules the daily watering-reminder check. Run this AFTER deploying the
-- Edge Function (`supabase functions deploy send-watering-reminders`).
-- Not part of schema.sql because it needs your project's own URL and a
-- secret substituted in below — copy this file, fill in the two values,
-- then run it once in the SQL Editor.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'send-watering-reminders-daily',
  '0 8 * * *', -- 08:00 UTC daily — adjust to your users' timezone as needed
  $$
  select net.http_post(
    url := 'https://ipjoeicxmxeiamflcnkf.supabase.co/functions/v1/send-watering-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY_HERE'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- To check it's registered:
--   select * from cron.job;
-- To remove it:
--   select cron.unschedule('send-watering-reminders-daily');
