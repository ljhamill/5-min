# Plan: MVP feature flag — view-only mode + Polymarket link

## Context

The app is **5 Min Terminal** (`trade.incantr.com`) — a Next.js 14 App Router trading
terminal for Polymarket's 5-minute crypto Up/Down markets. Markets/prices/orderbook
stream from Supabase and render live. Trading execution is NOT built yet
(`app/api/trade/route.ts` is a stub), so the first public MVP must ship **view-only**:

- Markets fully viewable (sidebar, chart, orderbook, prices) — unchanged.
- All trading/wallet UI stays **visible but disabled**, marked with a "SOON" badge
  (do NOT hide it — it previews what's coming).
- New: a **"View on Polymarket"** button in the order ticket panel that deep-links to
  the selected market on polymarket.com. This button is permanent — it must render
  in both MVP and full-trading modes, so build it outside the flag.

## The feature flag

Env var: `NEXT_PUBLIC_TRADING_ENABLED` (client-visible, needed in components).

- Unset, empty, or anything other than the literal string `"true"` → trading
  **disabled** (MVP mode). Fail-safe default: a missing var on a fresh deploy must
  land in view-only mode, never accidentally enable trading.
- `"true"` → full trading UI (current behavior).

Create `lib/featureFlags.ts`:

```ts
export const TRADING_ENABLED = process.env.NEXT_PUBLIC_TRADING_ENABLED === "true";
```

Import the constant everywhere; never read `process.env` directly in components.
(Next.js inlines `NEXT_PUBLIC_*` at build time, so flipping the var requires a
redeploy — that's expected and fine.)

Also create the shared badge once, `components/ui/SoonBadge.tsx`, copying the exact
styling of the existing SOON chip in `components/layout/SubNav.tsx` (~line 55):

```tsx
<span
  className="text-[9px] font-medium px-1 py-0.5 rounded leading-none"
  style={{ background: "var(--bg-overlay)", color: "var(--text-dim)", border: "1px solid var(--border)" }}
>
  SOON
</span>
```

Reuse this component in every task below — do not re-style it per call site.
(Optional cleanup if trivial: switch SubNav's inline chip to the shared component.)

## Tasks

### Task 1 — `lib/featureFlags.ts` + `SoonBadge`

As above. Two tiny new files.

### Task 2 — TopNav Connect Wallet (`components/layout/TopNav.tsx`)

The Connect Wallet button (~line 120) and its wagmi connect logic:

- `TRADING_ENABLED === false`: render the same button `disabled`, with reduced
  opacity (follow the app's existing `disabled:opacity-40` convention), a `SoonBadge`
  next to/inside the label, and no `onClick` wiring. Keep dimensions stable so the
  nav doesn't shift between modes.
- `true`: current behavior untouched.
- Check `components/wallet/WalletButton.tsx` — if it's rendered anywhere, apply the
  same treatment; if it's dead code, leave it alone (don't expand scope).

### Task 3 — OrderTicket (`components/trade/OrderTicket.tsx`)

This is the right-hand panel. Changes:

1. **Polymarket link button (permanent — renders regardless of flag).**
   - URL: `https://polymarket.com/event/${market.slug}` — `slug` is already on the
     `PolymarketMarket` object (populated from `source_slug` in `hooks/useMarkets.ts`).
   - Guard: if `slug` is empty, don't render the button.
   - Placement: bottom of the panel, below the trade buttons area, above the trade
     status block. Full-width secondary-style button (border `var(--border)`,
     text `var(--text-secondary)`, hover brightens) with a small ↗ external-link
     glyph. Label: `View on Polymarket`.
   - `target="_blank" rel="noopener noreferrer"`.
2. **MVP mode (`TRADING_ENABLED === false`):**
   - Size input + quick-pick buttons ($10/25/50/100): disabled, `opacity-40`.
   - Up/Down trade buttons: disabled, keep their layout/prices visible, add
     `SoonBadge` inside each button (or one badge on a "Trading" section header —
     pick whichever reads cleaner at the existing 280px panel width).
   - The "Connect wallet to trade" prompt block: replace its text with
     `Trading coming soon` + `SoonBadge` (in MVP mode the wallet CTA makes no sense).
   - Do NOT call `useTrade`'s execute path in this mode; guard `handleTrade` with an
     early return on `!TRADING_ENABLED` as defense-in-depth even though buttons are
     disabled.
3. **Full mode:** everything as today + the new Polymarket button.

### Task 4 — Other trade surfaces

Grep for every other place trade actions render and apply the same
disabled + `SoonBadge` treatment when the flag is off:

- `components/market/MarketRow.tsx` — has $-size input and ▲ Up / ▼ Down buttons
  (~lines 174–217) and calls `useTrade`. Same guard on its `handleTrade`.
- `components/market/MarketCard.tsx` → renders `components/market/TradePanel.tsx` —
  check whether MarketCard/MarketTable are actually mounted anywhere on the current
  page (`app/page.tsx` uses MarketSidebar + OrderTicket). If they're currently
  unmounted legacy components, apply the flag guard to `TradePanel` only if it's
  ≤10 lines of change; otherwise note them as unused and skip — don't gold-plate
  dead code.
- `components/layout/BottomBar.tsx` — shows wallet connection status
  ("Disconnected" + red dot). In MVP mode replace that wallet status cluster with
  `Trading` + `SoonBadge` (keep the POLYGON label).
- Grep `useTrade` and `useAccount` across `components/` to catch anything missed.

### Task 5 — Verify

1. `npm run build` passes.
2. Dev run **without** the env var set (`NEXT_PUBLIC_TRADING_ENABLED` absent from
   `.env.local` — this is how prod will run): confirm
   - markets, chart, orderbook, prices all still live-update untouched;
   - Connect Wallet disabled + SOON; order ticket inputs/buttons disabled + SOON;
   - no wallet modal can be opened from anywhere;
   - "View on Polymarket" opens the correct market (spot-check the slug against a
     live market — format `https://polymarket.com/event/btc-updown-5m-<unix>`).
3. Dev run with `NEXT_PUBLIC_TRADING_ENABLED=true` in `.env.local`: confirm current
   full behavior is restored, and the Polymarket button still shows.
4. Screenshot both modes at desktop width for eyeball diff.

### Task 6 — Deploy notes (include in final summary, don't execute without asking)

- Vercel: do NOT set `NEXT_PUBLIC_TRADING_ENABLED` in prod env (absent = view-only
  MVP). Locally, devs can add `NEXT_PUBLIC_TRADING_ENABLED=true` to `.env.local`.
- Commit + push to `main` auto-deploys `trade.incantr.com` — ask the user before
  pushing.

## Constraints

- Don't touch `supabase/` — this is purely a frontend change.
- Don't remove/rename any existing props or hooks; the flag gates rendering and
  handlers only. `useTrade`/wagmi stay imported and functional for full mode.
- Match existing styling idioms exactly (CSS vars like `var(--text-dim)`,
  `tabnum`, `opacity-40` disable convention, 280px right panel).
- Keep the diff tight: no refactors, no renames, no drive-by cleanups beyond the
  optional SubNav badge reuse noted in Task 1.
