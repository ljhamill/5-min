# Plan: Live market graph with server-stored history

## Goal

When a user opens any market they immediately see a Polymarket-style graph of where
that market has been trading — no waiting for data to accumulate in the browser.
The graph then ticks live. Series are individually toggleable:

1. **Market price** — the Up (YES) mid price in ¢, from the orderbook. Main series,
   like Polymarket's market page chart. Right price scale (0–100¢).
2. **Model probability** — our computed prob, dashed line, same right scale. Shows
   edge vs. market visually.
3. **Asset price** — the underlying (BTC/ETH/…) candles that the current chart shows.
   Left price scale ($). Off or on by user choice; remembers nothing between sessions
   (component state only).

History covers the market's full lifetime — from when the sync job first inserts it
(~20 min before close, since we sync live + 3 upcoming windows) to close. ~5s
resolution → ≤ ~250 points per market.

## Why server-side history (context for decisions below)

The browser only receives Supabase Realtime **broadcasts** (ephemeral, no replay) for
prices/orderbook. Nothing today stores mid-price history:

- `orderbook_state` is a current-snapshot table (upsert per token), no history.
- `markets.prob_history` was meant to hold prob snapshots but has TWO defects:
  (a) **it hardcodes `mid: 0.5`** in every entry, and (b) a **lost-update bug** —
  `chainlink-price-stream` reads `prob_history` once at invocation start, then every
  5s flush writes `[...startupSnapshot, newEntry]`, so each flush overwrites the
  previous flush's entry. Net effect: ~1 entry per minute survives instead of 12.
  Do not build on `prob_history`. This plan supersedes it.

The right design is an **insert-only ticks table** — appends can't race, reads are
one indexed query, retention is a simple delete.

## Backend (Supabase)

### 1. New table — run in SQL editor AND append to `supabase/schema.sql`

```sql
create table if not exists public.market_ticks (
  id          bigint generated always as identity primary key,
  market_id   text not null references public.markets(id) on delete cascade,
  ts          timestamptz not null default now(),
  mid_price   numeric,          -- Up-token orderbook mid (null on prob-only rows)
  model_prob  numeric           -- model probability (null on mid-only rows)
);

create index if not exists market_ticks_market_ts_idx
  on public.market_ticks(market_id, ts);

alter table public.market_ticks enable row level security;

create policy "market_ticks_read_all"
  on public.market_ticks for select
  to anon, authenticated
  using (true);
```

No Realtime needed on this table — live updates reach the browser via the existing
broadcast channels; the table is only for seeding history on open.

Writes come from Edge Functions using the service-role key, which bypasses RLS — no
insert policy needed.

### 2. Writers — two small Edge Function changes

**`supabase/functions/polymarket-orderbook-stream/index.ts`** — in the existing
`flushToDb()` (runs every 5s), additionally insert mid ticks for tokens that are the
**YES token of a market** (the map `tokenToMarket` already exists; make sure it can
distinguish YES tokens — only insert for `token_yes_id` matches, not NO tokens):

```ts
await supabase.from("market_ticks").insert(
  rows
    .filter((r) => r.market_id && isYesToken[r.token_id])
    .map((r) => ({ market_id: r.market_id, mid_price: r.mid_price })),
);
```

**`supabase/functions/chainlink-price-stream/index.ts`** — in its `flushToDb()`,
insert prob ticks alongside the existing `model_prob` update:

```ts
await supabase.from("market_ticks").insert(
  Object.entries(probUpdates).map(([marketId, u]) => ({
    market_id: marketId,
    model_prob: u.prob,
  })),
);
```

While in that file, also **delete the `prob_history` append logic** (the buggy
read-modify-write described above) — `market_ticks` replaces it. Leave the
`markets.prob_history` column itself alone (dropping it is a separate cleanup;
nothing reads it).

Volume check (spell-out): ~28–35 tradeable markets × 2 writers × 12 flushes/min
≈ **~800 rows/min ≈ 1.2M rows/day if never cleaned** — hence retention below.
With 2h retention the table sits at a steady ~100k rows, trivial for Postgres.
Inserts are batched (one insert statement per flush per function), so DB request
count doesn't change materially.

### 3. Retention — one new pg_cron job (append to `supabase/cron.sql`, run in SQL editor)

```sql
select cron.schedule(
  'cleanup-market-ticks',
  '*/15 * * * *',
  $$ delete from public.market_ticks where ts < now() - interval '2 hours'; $$
);
```

2 hours ≫ any market's ~20-minute lifetime; keeps the table tiny.

### 4. Deploy

```
SUPABASE_ACCESS_TOKEN=<ask user> npx supabase functions deploy polymarket-orderbook-stream --project-ref xwuxqnnvgblpewzkzpsl
SUPABASE_ACCESS_TOKEN=<ask user> npx supabase functions deploy chainlink-price-stream --project-ref xwuxqnnvgblpewzkzpsl
```

Ask the user to run the SQL (table + cron) in the Supabase SQL editor — the anon key
cannot DDL. Verify after a minute:
`select market_id, count(*) from market_ticks group by 1 limit 5;` — should show
rows accumulating ~12+/min per live market (mid) plus prob rows.

## Frontend

### 5. New hook — `hooks/useMarketHistory.ts`

```ts
export function useMarketHistory(marketId: string | undefined)
// → { midSeries: {time, value}[], probSeries: {time, value}[], isLoading }
```

- On `marketId` change: one query via the shared client (`getSupabase()`):
  `from("market_ticks").select("ts, mid_price, model_prob").eq("market_id", marketId).order("ts", { ascending: true })`
  Split into two series (rows where `mid_price` is non-null → midSeries; ditto prob).
  Convert `ts` → epoch **seconds** (`UTCTimestamp`), and **dedupe/clamp equal
  timestamps** — Lightweight Charts rejects non-monotonic times; two writers can
  land on the same second. Keep the last value per second per series.
- Live appends: reuse the **existing** subscriptions, don't open new channels —
  - `orderbook` broadcast (via the existing ref-counted shared channel in
    `hooks/useOrderbook.ts` — export a `subscribeOrderbook(listener)` helper from it
    rather than duplicating channel logic): payload has `marketId` + `midPrice`.
  - `asset-prices` broadcast: payload's `probUpdates[marketId].prob`.
  Append to state (again last-write-wins per second).
- Minute-boundary gaps (Edge Function restart, ~2–5s) are fine — line just has a
  small flat gap; do nothing special.

### 6. Chart component — rework `components/chart/PriceChart.tsx`

Current state: candles (Binance REST 1m seed + Binance WS kline live) on the right
scale, a prob line fed via `midPrice` prop. Both price scales are already enabled.
Rework into one chart with three series + a toggle row:

- **Series**
  - `marketSeries` (LineSeries or AreaSeries, right scale, 0–100 range formatted ¢,
    accent color) ← `midSeries` from `useMarketHistory`, live-appended.
  - `modelSeries` (LineSeries, dashed `lineStyle: 2`, right scale) ← `probSeries`.
  - `candleSeries` (existing CandlestickSeries, **left** scale now) ← keep the
    existing Binance REST seed + WS kline logic exactly as is, just moved to the
    left price scale option `priceScaleId: "left"`.
- **Toggles**: a row of three small chips above the chart (reuse the asset-chip
  styling from `SubNav.tsx` — active = `--accent-dim` bg): `Market`, `Model`,
  `BTC price` (label = actual asset). Default on: Market + Model; Asset off.
  Toggling calls `series.applyOptions({ visible })` — don't destroy/recreate series.
  When the asset series is hidden also hide the left price scale
  (`chart.priceScale("left").applyOptions({ visible })`) so the chart reclaims the
  gutter.
- **Scale formatting**: right scale `priceFormat: { type: "custom", formatter: v =>
  `${(v*100).toFixed(0)}¢` }` on both prob-domain series (values stay 0–1
  internally — same domain the payloads use).
- **Prop cleanup**: `PriceChart` currently receives `midPrice` from a bridge in
  `app/page.tsx` and pushes it into a ref-array series — delete that path (the hook
  now owns market-price data). Keep the `midPrice` prop removal minimal: update the
  bridge component in `app/page.tsx` to stop passing it; the `useOrderbook` call
  there is still needed by `Orderbook`/`OrderTicket`, so leave the rest alone.
  New props: `market: PolymarketMarket | null` (need `id` + `asset`).

### 7. UX details

- On market switch: `setData(seed)` then `chart.timeScale().fitContent()` once.
- While `isLoading`: keep the existing subtle "Loading…" pattern (see
  `Orderbook.tsx`) rather than a blank chart.
- Empty history (brand-new market, first ticks still arriving): render the chart
  frame; the line grows as broadcasts land. No error state needed.

## Verify (end-to-end)

1. SQL run → table exists; after ~2 min `market_ticks` has rows for live markets
   with BOTH `mid_price` rows and `model_prob` rows.
2. `npm run build` clean.
3. Open the app, select the live BTC market → market line renders **instantly**
   with ~20 min of history (or however long the market has existed), then visibly
   ticks every few seconds.
4. Toggle each chip on/off — series show/hide, left scale disappears when asset
   candles are off.
5. Switch markets rapidly — no duplicate series, no stale lines from the previous
   market (the effect must clear series data on market change).
6. Leave open across a minute boundary — small gap, no crash, resumes.
7. `select count(*) from market_ticks;` after 30+ min stays bounded (cleanup job
   working — may need to wait for a :15 tick or run the delete manually once).

## Implications summary (for the user)

- **Supabase**: +1 table (~100k rows steady-state, ~1.2M inserts/day in ~17k
  batched statements/day — well within free-tier request budget), +1 cron job,
  2 Edge Function redeploys. `prob_history` writing stops (it was buggy anyway).
- **Frontend**: chart becomes market-first with toggleable series; asset candles
  still available (still Binance-sourced — swapping that to Chainlink ticks is a
  possible later cleanup, out of scope here).
- **Latency/UX**: history appears in one query on open (instant); live cadence is
  ~1–5s from the existing broadcast pipeline; ~2–5s gap at minute boundaries is
  inherent to the 55s Edge Function loop and acceptable.

## Constraints

- Don't create new Realtime channels; extend the existing shared ones.
- Don't drop or repurpose `markets.prob_history` in this change; just stop writing it.
- Insert-only writes to `market_ticks` from Edge Functions; no upserts, no
  read-modify-write.
- Match existing styling idioms (CSS vars, chip styling from SubNav, 200px/flex
  layout of the center column unchanged).
- Ask the user before any git push; Supabase deploys need a fresh access token from
  the user (previous ones expire quickly).
