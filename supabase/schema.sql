-- =============================================================================
-- 5 Min Terminal — Supabase Schema
-- =============================================================================
-- Run in Supabase SQL Editor. Safe to re-run (uses IF NOT EXISTS throughout).
-- =============================================================================


-- ---------------------------------------------------------------------------
-- MARKETS
-- Stores prediction market contracts from any source (Polymarket, Kalshi, etc.)
-- One row per market window per asset. Worker upserts on each Gamma API poll.
-- ---------------------------------------------------------------------------
create table if not exists public.markets (

  -- Identity
  id              text primary key,             -- our internal ID (e.g. polymarket market ID)
  source          text not null,                -- 'polymarket' | 'kalshi' | 'manifold' | ...
  source_id       text not null,                -- ID in the source system
  source_slug     text,                         -- slug / URL key from source
  market_type     text not null,                -- 'crypto' | 'sports' | 'politics' | ...

  -- Display
  title           text not null,                -- human-readable market name
  description     text,                         -- longer description if available

  -- Asset linkage (null for non-price markets like sports)
  asset           text,                         -- 'BTC' | 'ETH' | 'SOL' | null

  -- Timing
  window_start    timestamptz,                  -- when this window opens
  end_date        timestamptz not null,         -- when market closes / resolves
  window_seconds  integer not null default 300, -- window duration in seconds (300 = 5 min)

  -- Binary outcome tokens (Polymarket-style CLOB)
  -- Null for sources that don't use this model (e.g. AMM-based)
  token_yes_id    text,                         -- YES outcome CLOB token ID
  token_no_id     text,                         -- NO outcome CLOB token ID
  tick_size       text not null default '0.01', -- minimum price increment

  -- Current market prices (upserted by worker on each WS/API update)
  price_yes       numeric,                      -- last traded YES price (0–1)
  price_no        numeric,                      -- last traded NO price (0–1)
  mid_price       numeric,                      -- (best_bid + best_ask) / 2 from orderbook

  -- Model outputs (computed by worker, upserted continuously)
  model_prob      numeric,                      -- binary option model probability (0–1)
  edge            numeric,                      -- model_prob − mid_price (signed)
  vol_ann         numeric,                      -- annualized vol used in this calculation
  drift_used      numeric,                      -- drift signal used in this calculation

  -- Probability history for the chart overlay
  -- JSONB array of {ts: unix_ms, prob: number, mid: number}, capped at window_seconds entries
  -- Worker appends each second, trims to last window_seconds entries
  prob_history    jsonb not null default '[]',

  -- Status
  status          text not null default 'upcoming', -- 'upcoming' | 'active' | 'closed' | 'resolved'
  accepting_orders boolean not null default false,

  -- Source-specific fields that don't map cleanly to the above
  -- e.g. { "neg_risk": false, "oracle": "chainlink", "sport": "NFL", "teams": ["KC","SF"] }
  metadata        jsonb not null default '{}',

  -- Housekeeping
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- Prevent duplicate imports from the same source
  unique (source, source_id)
);

-- Indexes for common query patterns
create index if not exists markets_source_idx       on public.markets(source);
create index if not exists markets_market_type_idx  on public.markets(market_type);
create index if not exists markets_asset_idx        on public.markets(asset);
create index if not exists markets_status_idx       on public.markets(status);
create index if not exists markets_end_date_idx     on public.markets(end_date);
create index if not exists markets_accepting_idx    on public.markets(accepting_orders) where accepting_orders = true;


-- ---------------------------------------------------------------------------
-- ASSET PRICES
-- One row per asset, upserted in place on every price tick from the worker.
-- Supabase Realtime broadcasts each upsert to all subscribed browsers.
-- ---------------------------------------------------------------------------
create table if not exists public.asset_prices (

  asset           text primary key,             -- 'BTC' | 'ETH' | 'SOL' | 'XRP' | ...
  price_source    text not null default 'binance', -- 'binance' | 'coinbase' | 'kraken' | ...

  -- Current values
  price           numeric not null,             -- latest trade price
  price_prev      numeric,                      -- previous tick price (for direction arrow)
  vol_ann         numeric,                      -- annualized realized vol (60-tick rolling)
  drift_30s       numeric,                      -- 30-tick log return as momentum signal

  updated_at      timestamptz not null default now()
);


-- ---------------------------------------------------------------------------
-- MARKET TICKS
-- Insert-only history of a market's Up-price and model probability, appended
-- every ~5s by the price/orderbook workers. Powers the market graph's instant
-- history-on-open — Realtime broadcasts are ephemeral and can't be replayed,
-- so this table is the seed; the browser's live tail still comes from
-- Realtime broadcast, not from polling this table.
-- Retention: cleaned up ~2h after write (see cron.sql) — a market only lives
-- ~20 minutes, so 2h is a generous safety margin, not a real retention window.
-- ---------------------------------------------------------------------------
create table if not exists public.market_ticks (
  id          bigint generated always as identity primary key,
  market_id   text not null references public.markets(id) on delete cascade,
  ts          timestamptz not null default now(),
  mid_price   numeric,          -- Up-token orderbook mid (null on prob-only rows)
  model_prob  numeric           -- model probability (null on mid-only rows)
);

create index if not exists market_ticks_market_ts_idx
  on public.market_ticks(market_id, ts);


-- ---------------------------------------------------------------------------
-- ORDERBOOK STATE
-- One row per CLOB token, upserted in place on each orderbook WebSocket message.
-- Stores top N levels only (worker trims to top 10 each side before writing).
-- ---------------------------------------------------------------------------
create table if not exists public.orderbook_state (

  token_id        text primary key,             -- Polymarket CLOB token ID
  market_id       text references public.markets(id) on delete cascade,
  source          text not null default 'polymarket',

  -- Top 10 levels each side: [{price: "0.52", size: "150.00"}, ...]
  bids            jsonb not null default '[]',
  asks            jsonb not null default '[]',

  -- Derived (computed by worker before write, avoids browser computation)
  best_bid        numeric,
  best_ask        numeric,
  mid_price       numeric,
  spread          numeric,

  updated_at      timestamptz not null default now()
);


-- ---------------------------------------------------------------------------
-- USERS
-- Wallet = identity. Created on first trade or wallet connect.
-- ---------------------------------------------------------------------------
create table if not exists public.users (
  wallet_address  text primary key,
  first_seen_at   timestamptz not null default now(),
  last_seen_at    timestamptz not null default now()
);


-- ---------------------------------------------------------------------------
-- TRADES
-- Record of every trade placed through the terminal.
-- ---------------------------------------------------------------------------
create table if not exists public.trades (
  id              uuid primary key default gen_random_uuid(),
  wallet_address  text not null references public.users(wallet_address),
  market_id       text not null references public.markets(id),
  source          text not null,                -- which platform the trade was routed to
  side            text not null check (side in ('YES', 'NO')),
  amount_usdc     numeric(18, 6) not null,
  price           numeric(18, 6) not null,      -- fill price
  model_prob      numeric,                      -- model probability at time of trade
  edge            numeric,                      -- edge at time of trade
  tx_hash         text,
  created_at      timestamptz not null default now()
);

create index if not exists trades_wallet_idx  on public.trades(wallet_address);
create index if not exists trades_market_idx  on public.trades(market_id);
create index if not exists trades_source_idx  on public.trades(source);


-- ---------------------------------------------------------------------------
-- FEE CONFIG
-- Admin-controlled builder fee, live without redeployment.
-- ---------------------------------------------------------------------------
create table if not exists public.fee_config (
  id          bigint generated always as identity primary key,
  fee_bps     integer not null check (fee_bps >= 0 and fee_bps <= 10000),
  source      text not null default 'polymarket', -- fee can vary per source in future
  updated_at  timestamptz not null default now(),
  updated_by  text not null                      -- admin wallet address
);

-- Default: 0 bps (disabled)
insert into public.fee_config (fee_bps, source, updated_by)
values (0, 'polymarket', '0x0000000000000000000000000000000000000000')
on conflict do nothing;


-- ---------------------------------------------------------------------------
-- WAITLIST
-- Emails captured from the incantr.com marketing/landing page while the
-- terminal is in closed beta. Anon can INSERT only — no public read, so the
-- list itself is never exposed to the browser.
-- ---------------------------------------------------------------------------
create table if not exists public.waitlist (
  id          bigint generated always as identity primary key,
  email       text not null unique,
  source      text,                         -- which CTA: 'hero' | 'footer' etc.
  created_at  timestamptz not null default now()
);


-- ---------------------------------------------------------------------------
-- PROFILES
-- Mirrors auth.users (Supabase Auth) one-to-one. Created automatically by
-- the handle_new_user trigger on signup. `approved` gates entry to the
-- terminal during closed beta — flipped manually via SQL/dashboard for now.
-- Deliberately separate from public.users (wallet-address-keyed identity,
-- wired up later when wallet linking happens) — these are different
-- identity concepts that will get connected in a future pass.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  approved    boolean not null default false,
  created_at  timestamptz not null default now()
);

-- Auto-create a profile row when a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------
alter table public.markets        enable row level security;
alter table public.asset_prices   enable row level security;
alter table public.orderbook_state enable row level security;
alter table public.market_ticks   enable row level security;
alter table public.users          enable row level security;
alter table public.trades         enable row level security;
alter table public.fee_config     enable row level security;
alter table public.waitlist       enable row level security;
alter table public.profiles       enable row level security;

-- Public read for all market data (terminal is public-facing)
create policy "markets_public_read"
  on public.markets for select using (true);

create policy "asset_prices_public_read"
  on public.asset_prices for select using (true);

create policy "orderbook_public_read"
  on public.orderbook_state for select using (true);

create policy "market_ticks_public_read"
  on public.market_ticks for select using (true);

create policy "fee_config_public_read"
  on public.fee_config for select using (true);

-- Trades: users read their own rows only
create policy "trades_own_read"
  on public.trades for select using (true); -- tighten to wallet auth when ready

-- Waitlist: anonymous signup, no public read (no SELECT/UPDATE/DELETE policy
-- exists, so only the dashboard/service_role can read the list)
create policy "waitlist_anon_insert"
  on public.waitlist for insert to anon, authenticated with check (true);

-- Profiles: users can read their own profile only (needed so the auth gate,
-- running with the user's own session, can check `approved`). No insert or
-- update policy at all — inserts happen only via the handle_new_user
-- trigger (security definer, bypasses RLS), and `approved` can only be
-- flipped via the dashboard/SQL editor. A user genuinely cannot self-approve.
create policy "profiles_own_read"
  on public.profiles for select
  using (auth.uid() = id);


-- ---------------------------------------------------------------------------
-- REALTIME
-- Enable broadcast on the tables the browser subscribes to.
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.markets;
alter publication supabase_realtime add table public.asset_prices;
alter publication supabase_realtime add table public.orderbook_state;
