-- 5 Min Terminal — Supabase schema
-- Run this in the Supabase SQL editor to set up the database.

-- Users (wallet = identity, no passwords)
create table if not exists public.users (
  wallet_address text primary key,
  first_seen_at  timestamptz not null default now(),
  last_seen_at   timestamptz not null default now()
);

-- Fee config (admin-controlled, live without redeployment)
create table if not exists public.fee_config (
  id          bigint generated always as identity primary key,
  fee_bps     integer not null check (fee_bps >= 0 and fee_bps <= 10000),
  updated_at  timestamptz not null default now(),
  updated_by  text not null  -- admin wallet address
);

-- Insert default (0 bps = disabled)
insert into public.fee_config (fee_bps, updated_by)
values (0, '0x0000000000000000000000000000000000000000');

-- Trade history (optional, for analytics and user history display)
create table if not exists public.trades (
  id              uuid primary key default gen_random_uuid(),
  wallet_address  text not null references public.users(wallet_address),
  market_id       text not null,
  side            text not null check (side in ('YES', 'NO')),
  amount_usdc     numeric(18, 6) not null,
  price           numeric(18, 6) not null,
  tx_hash         text,
  created_at      timestamptz not null default now()
);

create index if not exists trades_wallet_idx on public.trades(wallet_address);
create index if not exists trades_market_idx on public.trades(market_id);

-- RLS: users can read their own trades, admins (service role) can write
alter table public.users enable row level security;
alter table public.fee_config enable row level security;
alter table public.trades enable row level security;

-- Public read of fee config (frontend needs current fee for display)
create policy "fee_config_public_read" on public.fee_config
  for select using (true);

-- Trades: users read their own rows
create policy "trades_own_read" on public.trades
  for select using (true);  -- adjust to wallet-based auth when ready
