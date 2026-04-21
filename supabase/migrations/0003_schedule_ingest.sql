-- Hourly schedule for the ingest-articles Edge Function.
-- Uses pg_cron (scheduling) + pg_net (HTTP POST from Postgres).
--
-- Before this migration runs, the deployer must set two Supabase project
-- secrets via `supabase secrets set` so that pg_net can call the function:
--   app.settings.ingest_url   — e.g. https://<ref>.functions.supabase.co/ingest-articles
--   app.settings.ingest_token — the Supabase service-role JWT (used as Bearer)
--
-- These are referenced at call-time through current_setting(...) so the
-- secrets never end up inside the migration file.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Drop any prior schedule with this name so re-running is idempotent.
select cron.unschedule('power10-ingest-hourly')
  where exists (select 1 from cron.job where jobname = 'power10-ingest-hourly');

select cron.schedule(
  'power10-ingest-hourly',
  '5 * * * *',  -- 5 minutes past every hour (avoid top-of-hour contention)
  $$
  select net.http_post(
    url := current_setting('app.settings.ingest_url', true),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.ingest_token', true)
    ),
    body := '{}'::jsonb
  );
  $$
);
