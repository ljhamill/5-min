-- =============================================================================
-- 5 Min Terminal — pg_cron schedules
-- =============================================================================
-- Run in Supabase SQL Editor after deploying Edge Functions.
-- Replace YOUR_PROJECT_REF and YOUR_SERVICE_ROLE_KEY with real values.
-- Find them in: Supabase Dashboard → Settings → API
-- =============================================================================

-- Enable required extensions
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ---------------------------------------------------------------------------
-- 1. Sync markets from Gamma API — every minute
-- ---------------------------------------------------------------------------
select cron.schedule(
  'sync-5min-markets',
  '* * * * *',
  $$
  select net.http_post(
    url     := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/sync-5min-markets',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- ---------------------------------------------------------------------------
-- 2. Binance price stream — every minute (runs for 55s internally)
-- ---------------------------------------------------------------------------
select cron.schedule(
  'binance-price-stream',
  '* * * * *',
  $$
  select net.http_post(
    url     := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/binance-price-stream',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- ---------------------------------------------------------------------------
-- 3. Polymarket orderbook stream — every minute (runs for 55s internally)
-- ---------------------------------------------------------------------------
select cron.schedule(
  'polymarket-orderbook-stream',
  '* * * * *',
  $$
  select net.http_post(
    url     := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/polymarket-orderbook-stream',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- ---------------------------------------------------------------------------
-- 4. Clear prob_history on closed markets — every 10 minutes
-- ---------------------------------------------------------------------------
select cron.schedule(
  'clear-prob-history',
  '*/10 * * * *',
  $$
  update public.markets
  set    prob_history = '[]',
         updated_at   = now()
  where  status       = 'closed'
  and    prob_history != '[]';
  $$
);

-- ---------------------------------------------------------------------------
-- 5. Delete markets older than 30 days — nightly at 3 AM UTC
-- ---------------------------------------------------------------------------
select cron.schedule(
  'cleanup-old-markets',
  '0 3 * * *',
  $$
  delete from public.markets
  where end_date < now() - interval '30 days';
  $$
);

-- ---------------------------------------------------------------------------
-- 6. Clean up orderbook state for closed markets — nightly at 3:05 AM UTC
-- ---------------------------------------------------------------------------
select cron.schedule(
  'cleanup-old-orderbooks',
  '5 3 * * *',
  $$
  delete from public.orderbook_state
  where market_id in (
    select id from public.markets
    where status = 'closed'
    and   end_date < now() - interval '24 hours'
  );
  $$
);

-- ---------------------------------------------------------------------------
-- View scheduled jobs (verify setup)
-- ---------------------------------------------------------------------------
-- select * from cron.job;

-- ---------------------------------------------------------------------------
-- To remove a job:
-- ---------------------------------------------------------------------------
-- select cron.unschedule('job-name-here');
