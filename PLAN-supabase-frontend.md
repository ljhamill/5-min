# Plan: Switch frontend from direct external connections to Supabase backend

## Context (read this first)

The app is **5 Min Terminal** (`trade.incantr.com`) — a trading terminal for Polymarket's
5-minute crypto Up/Down markets. A Supabase backend pipeline is **already live and
writing data**; the frontend still connects directly to Binance/Polymarket/Gamma from
the browser. The job is to rewire the frontend to read from Supabase, without touching
the Edge Functions or schema (they work).

### Live backend (do NOT modify)

Supabase project: `xwuxqnnvgblpewzkzpsl.supabase.co`. Three pg_cron jobs run every
minute, each invoking an Edge Function that holds a connection for 55s:

1. **`sync-5min-markets`** — pulls 5-min markets from Polymarket Gamma API, upserts
   into `markets` table. Markets run 24/7, ~500+ rows with status
   `active | upcoming | closed`.
2. **`chainlink-price-stream`** — polls Chainlink on-chain feeds (BTC/ETH/BNB via
   Polygon RPC) + Pyth Hermes REST (SOL/DOGE/XRP/HYPE) every 1s. Each tick it:
   - broadcasts on Realtime channel **`asset-prices`**, event **`price`**, payload:
     ```ts
     { asset: string; price: number; prevPrice: number; volAnn: number;
       drift30s: number; probUpdates: Record<string, {prob: number; edge: number}>;
       ts: number }
     ```
   - every 5s upserts `asset_prices` and updates `markets.model_prob`, `markets.edge`,
     `markets.prob_history` (last 60 entries of `{ts, prob, mid}`).
3. **`polymarket-orderbook-stream`** — subscribes to Polymarket CLOB WS for all active
   YES tokens. Each book event it:
   - broadcasts on Realtime channel **`orderbook`**, event **`orderbook`**, payload:
     ```ts
     { tokenId: string; marketId: string; bids: Level[]; asks: Level[];
       bestBid: number; bestAsk: number; midPrice: number; spread: number; ts: number }
     ```
     where `Level = { price: string; size: string }` (max 10 levels each side)
   - every 5s upserts `orderbook_state` keyed on `token_id`.

### Key tables (columns the frontend needs)

- **`markets`**: `id, source, source_id, source_slug, market_type, title, asset,
  window_start, end_date, window_seconds, token_yes_id, token_no_id, tick_size,
  price_yes, price_no, mid_price, status, accepting_orders, model_prob, edge,
  prob_history (jsonb), metadata (jsonb), updated_at`
- **`asset_prices`**: `asset (pk), price_source, price, price_prev, vol_ann,
  drift_30s, updated_at`
- **`orderbook_state`**: `token_id (pk), market_id, bids (jsonb), asks (jsonb),
  best_bid, best_ask, mid_price, spread, updated_at`

Realtime (Postgres Changes) is already enabled on `markets`, `asset_prices`,
`orderbook_state`. Broadcast channels need no setup.

### Frontend stack

Next.js 14 App Router, TypeScript, Tailwind, TanStack Query, wagmi v2.
Supabase browser client already exists at `lib/supabase/client.ts`
(`createBrowserClient` from `@supabase/ssr`; env vars `NEXT_PUBLIC_SUPABASE_URL`
and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set locally and on Vercel).
Generated DB types at `lib/supabase/types.ts`.

---

## The work

### Task 1 — Shared Supabase client singleton

`lib/supabase/client.ts` currently exports `createClient()` which makes a new client
per call. Realtime needs ONE shared client so all hooks multiplex over a single WS.

- Add a module-level singleton: `let client: SupabaseClient | undefined` and
  `export function getSupabase() { return (client ??= createBrowserClient(...)); }`
- Keep the old export for compatibility if anything imports it.

### Task 2 — `useMarkets` → read from Supabase

File: `hooks/useMarkets.ts`. Today it fetches `/api/markets` (a Next API route that
proxies Gamma) via TanStack Query every 30s.

Replace with:

1. Initial fetch via Supabase query (keep TanStack Query for caching):
   ```ts
   supabase.from("markets")
     .select("*")
     .in("status", ["active", "upcoming"])
     .eq("accepting_orders", true)
     .order("window_start", { ascending: true })
   ```
2. Map DB rows → the existing `PolymarketMarket` type (`lib/polymarket/types.ts`) so
   **no component changes are needed**. Mapping:
   - `id` ← `id`; `question`/`title` ← `title`; `slug` ← `source_slug`
   - `end_date_iso` ← `end_date`; `window_start_iso` ← `window_start`
   - `tokens` ← build 2-element array from `token_yes_id`/`price_yes` (outcome "Yes")
     and `token_no_id`/`price_no` (outcome "No"), `winner: false`
   - `active` ← `status === "active"`; `closed` ← `status === "closed"`
   - `tick_size` ← `tick_size`; `neg_risk` ← `metadata.neg_risk ?? false`
   - `asset` ← `asset`; `direction` ← `metadata.direction ?? "above"`
   - compute `seconds_remaining`, `seconds_elapsed`, `window_progress` from
     `window_start`/`end_date` vs `Date.now()` (same math as the old API route —
     check `app/api/markets/route.ts` for reference before deleting).
3. Subscribe to Postgres Changes for live updates:
   ```ts
   supabase.channel("markets-changes")
     .on("postgres_changes",
         { event: "*", schema: "public", table: "markets" },
         () => queryClient.invalidateQueries({ queryKey: ["markets"] }))
     .subscribe()
   ```
   Debounce invalidations to at most once per 5s (the sync job updates many rows per
   minute; naive invalidation would refetch dozens of times).
4. Keep a 60s `refetchInterval` as a fallback so countdown-based status transitions
   (active → closed) don't rely solely on Realtime.

### Task 3 — `useBinancePrices` → `useAssetPrices` (Broadcast)

File: `hooks/useBinancePrice.ts`. Today it opens a Binance WS in the browser and
computes vol/drift locally.

Replace with a new hook `useAssetPrices` (keep the same return shape
`Record<string, AssetData>` where `AssetData = { price, prevPrice, vol, drift30s,
lastUpdated }` — components destructure these fields):

1. Seed initial state from DB so the UI isn't blank while waiting for broadcasts:
   ```ts
   supabase.from("asset_prices").select("*")
   ```
   Map `vol_ann → vol`, `price_prev → prevPrice`, `drift_30s → drift30s`,
   `updated_at → lastUpdated`.
2. Subscribe to broadcast:
   ```ts
   supabase.channel("asset-prices")
     .on("broadcast", { event: "price" }, ({ payload }) => { ...setData... })
     .subscribe()
   ```
   Payload fields: `asset, price, prevPrice, volAnn, drift30s, probUpdates, ts`.
3. Also surface `probUpdates` from the payload — export a second piece of state
   `probByMarket: Record<string, {prob, edge}>` (merged, latest wins). The order
   ticket / sidebar can use this for live model-prob display later; fine to leave
   unconsumed for now.
4. Handle the gap: broadcasts stop for ~2–5s each minute when the Edge Function
   restarts (cron boundary). Do NOT clear state on channel close; just keep last
   values. Re-subscribe on `CHANNEL_ERROR`/`TIMED_OUT` with a 2s backoff.
5. Rename usages: `app/page.tsx` imports `useBinancePrices` and the type
   `AssetData` from `@/hooks/useBinancePrice`. Update imports in `app/page.tsx`,
   `components/layout/BottomBar.tsx`, and anywhere else `grep -r useBinancePrices`
   hits. Delete `lib/binance/` only if nothing else imports it —
   **`components/chart/PriceChart.tsx` uses Binance REST for historical candles;
   leave that alone** (chart history is out of scope).

### Task 4 — `useOrderbook` → Supabase Broadcast

File: `hooks/useOrderbook.ts`. Today it opens a CLOB WS per selected token (and the
URL it uses, `wss://clob.polymarket.com/ws`, is wrong anyway — the working one is
`wss://ws-subscriptions-clob.polymarket.com/ws/market`).

Replace with:

1. Seed from DB on token change:
   ```ts
   supabase.from("orderbook_state").select("*").eq("token_id", tokenId).maybeSingle()
   ```
   Map `best_bid → bestBid`, `best_ask → bestAsk`, `mid_price → midPrice`.
2. Subscribe to the `orderbook` broadcast channel, filter client-side:
   ```ts
   .on("broadcast", { event: "orderbook" }, ({ payload }) => {
     if (payload.tokenId !== tokenId) return;
     setBook({ bids: payload.bids, asks: payload.asks, ... });
   })
   ```
3. Keep return shape `OrderbookData | null` exactly as-is (components:
   `Orderbook.tsx`, `OrderTicket.tsx`, `app/page.tsx` bridge).
4. One shared channel: because `useOrderbook` is mounted 2× (page bridge + Orderbook
   component), subscribe to a channel named `"orderbook"` via the singleton client —
   supabase-js dedupes channels by name on the same client, but calling
   `removeChannel` in one hook's cleanup would kill the other's subscription.
   Safest pattern: a tiny module-level ref-count
   (`subscribers++` on mount, `removeChannel` only when it hits 0).

### Task 5 — Delete dead code paths

Only after Tasks 2–4 compile and run:

- `app/api/markets/route.ts` (Gamma proxy) — delete; nothing else should call it.
  Grep first: `grep -r "api/markets" app components hooks lib`.
- `lib/binance/assets.ts` — delete IF unused after Task 3 (PriceChart may import
  symbol maps for its kline REST URL — if so, move just that map into the chart lib
  or leave the file).
- Old CLOB WS constants in `hooks/useOrderbook.ts` go away with the rewrite.
- Do NOT delete `lib/polymarket/` — types and helpers (`getBestBid` etc.) are still
  used.

### Task 6 — Verify

1. `npm run build` — must pass clean (typecheck).
2. `npm run dev`, open the app:
   - Sidebar shows grouped markets with LIVE/UPCOMING headers within ~2s of load.
   - BottomBar shows 7 assets (BTC ETH SOL XRP DOGE HYPE BNB) with prices ticking
     ~1/s. (ADA was removed — should NOT appear.)
   - Selecting a market populates the orderbook within ~1s and it updates live.
   - DevTools → Network → WS: there should be exactly ONE websocket, to
     `*.supabase.co/realtime/v1/websocket`. Zero connections to binance.com or
     polymarket.com WS endpoints. (Binance REST for chart candles is still expected.)
   - Watch across a minute boundary: prices stall ≤5s then resume (Edge Function
     restart) — acceptable; UI must not blank or error.
3. Countdown to a window close: market should flip out of LIVE within ~60s
   (fallback refetch) — confirm no stuck "LIVE" markets.

### Task 7 (backend, optional but recommended) — fix cold-start vol

The one known backend defect. Each `chainlink-price-stream` invocation starts with an
empty `priceHistory`, so for the first ~30s of every minute `calcRealizedVol` runs on
too few ticks and vol reads artificially low, which skews `model_prob`.

Fix — persist history across invocations:

1. Add a small table (this is the ONE allowed schema change):
   ```sql
   create table if not exists price_ticks (
     asset text not null,
     ts timestamptz not null,
     price numeric not null,
     primary key (asset, ts)
   );
   -- no realtime needed; add to nightly cleanup: delete where ts < now() - interval '10 minutes'
   ```
2. In `chainlink-price-stream` startup, load the last 60 ticks per asset:
   `select * from price_ticks where ts > now() - interval '90 seconds' order by ts`
   and seed `priceHistory` from them.
3. In the existing 5s `flushToDb`, also insert current tick rows into `price_ticks`
   (7 rows / 5s ≈ 120k rows/day — add `delete from price_ticks where ts < now() -
   interval '10 minutes'` to the flush or a cron job to keep it tiny).
4. Redeploy: `SUPABASE_ACCESS_TOKEN=<token> npx supabase functions deploy
   chainlink-price-stream --project-ref xwuxqnnvgblpewzkzpsl`. Ask the user for the
   access token; do not commit it.
5. Verify: `select asset, vol_ann from asset_prices` a few seconds after a minute
   boundary — vol should be stable (~0.3–1.0 annualised for majors), not ~0.0002.

---

## Explicitly out of scope

- Real CLOB trade execution (`app/api/trade/route.ts` stub) — needs Polymarket
  builder credentials, separate piece of work.
- L1 auth / EIP-712 onboarding.
- Chart historical candles source (still Binance REST — fine for now).
- Prob-history sparklines.

---

## Constraints & gotchas

- **Do not modify** `supabase/functions/*`, `supabase/schema.sql`, `supabase/cron.sql`.
- **Do not change component props/types** — the whole point of the mapping layer in
  Task 2/3 is zero component churn. If a component genuinely needs a change, keep it
  minimal and explain why.
- Broadcast payloads use `volAnn`; the frontend type uses `vol`. Map explicitly.
- `prob_history` on markets is there for a future sparkline — ignore it for now.
- Env vars are already configured; if `NEXT_PUBLIC_SUPABASE_*` are missing locally,
  stop and ask rather than hardcoding keys.
- The anon key has read access via RLS to all three tables; broadcasts require no
  auth. If a query unexpectedly returns zero rows, check RLS before assuming the
  table is empty (`select count(*)` in SQL editor shows truth).
- Deploy: push to main → Vercel auto-deploys `trade.incantr.com`. Verify prod after
  deploy with the same checklist as Task 6.
