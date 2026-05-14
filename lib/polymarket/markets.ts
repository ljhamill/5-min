import type { PolymarketMarket } from "./types";

const GAMMA_API = "https://gamma-api.polymarket.com";

// Maps slug prefixes to display tickers
// Slug format: {asset}-updown-5m-{unix_start_timestamp}
const SLUG_ASSET_MAP: Record<string, string> = {
  btc:  "BTC",
  eth:  "ETH",
  sol:  "SOL",
  xrp:  "XRP",
  bnb:  "BNB",
  doge: "DOGE",
  hype: "HYPE",
  ada:  "ADA",
};

function parseSlugAsset(slug: string): string | undefined {
  const prefix = slug.split("-updown-5m")[0];
  return SLUG_ASSET_MAP[prefix.toLowerCase()];
}

export async function fetchFiveMinuteMarkets(): Promise<PolymarketMarket[]> {
  // 5-min markets live under the events endpoint, not /markets.
  // Pre-created many windows ahead — we fetch recent ones and filter to
  // those currently accepting orders (i.e. the live + next window).
  const res = await fetch(
    `${GAMMA_API}/events?active=true&closed=false&limit=200&order=startDate&ascending=false`,
    { cache: "no-store" },
  );

  if (!res.ok) throw new Error(`Gamma API error: ${res.status}`);

  const events: Record<string, unknown>[] = await res.json();

  const now = Date.now();

  return events
    .filter((e) => {
      const slug = (e.slug as string) ?? "";
      return (
        slug.includes("updown-5m") &&
        Boolean((e.markets as unknown[])?.[0]) &&
        // acceptingOrders = currently tradeable
        Boolean(((e.markets as Record<string, unknown>[])[0]).acceptingOrders)
      );
    })
    .map((e) => {
      const slug = (e.slug as string);
      const asset = parseSlugAsset(slug);
      const market = (e.markets as Record<string, unknown>[])[0];

      // Token IDs stored as a JSON string
      let upTokenId = "";
      let downTokenId = "";
      try {
        const ids: string[] = JSON.parse(market.clobTokenIds as string);
        upTokenId   = ids[0] ?? "";
        downTokenId = ids[1] ?? "";
      } catch {}

      // Prices stored as JSON string array ["0.505", "0.495"]
      let upPrice = 0.5;
      let downPrice = 0.5;
      try {
        const prices: string[] = JSON.parse(market.outcomePrices as string);
        upPrice   = parseFloat(prices[0] ?? "0.5");
        downPrice = parseFloat(prices[1] ?? "0.5");
      } catch {}

      const endDate = (e.endDate as string) ?? (market.endDate as string) ?? "";

      // Slug timestamp is the start of the 5-minute window (Unix seconds)
      const startTs = parseInt(slug.match(/updown-5m-(\d+)/)?.[1] ?? "0") * 1000;
      const windowStartIso = startTs ? new Date(startTs).toISOString() : "";
      const secondsElapsed = startTs ? Math.max(0, Math.floor((now - startTs) / 1000)) : 0;
      const secondsRemaining = Math.max(0, Math.floor((new Date(endDate).getTime() - now) / 1000));

      return {
        id: market.id as string,
        question: e.title as string,
        slug,
        end_date_iso: endDate,
        window_start_iso: windowStartIso,
        seconds_elapsed: secondsElapsed,
        tokens: [
          { token_id: upTokenId,   outcome: "Yes" as const, price: upPrice,   winner: false },
          { token_id: downTokenId, outcome: "No"  as const, price: downPrice, winner: false },
        ],
        active: Boolean(e.active),
        closed: Boolean(e.closed),
        tick_size: String(market.orderPriceMinTickSize ?? "0.01"),
        neg_risk: false,
        asset,
        strike: undefined,
        direction: "above" as const,
        // Convenience: how far into the 5-min window we are (0–1)
        window_progress: Math.min(1, secondsElapsed / 300),
        seconds_remaining: secondsRemaining,
      };
    })
    .sort((a, b) => {
      // Primary: soonest window first (so the live/next window is at the top)
      const timeDiff = new Date(a.end_date_iso).getTime() - new Date(b.end_date_iso).getTime();
      if (timeDiff !== 0) return timeDiff;
      // Secondary: consistent asset order within each window
      const assetOrder = ["BTC", "ETH", "SOL", "XRP", "BNB", "DOGE", "HYPE", "ADA"];
      return assetOrder.indexOf(a.asset ?? "") - assetOrder.indexOf(b.asset ?? "");
    });
}

export function getBestBid(bids: { price: string; size: string }[]): number {
  if (!bids.length) return 0;
  return Math.max(...bids.map((b) => parseFloat(b.price)));
}

export function getBestAsk(asks: { price: string; size: string }[]): number {
  if (!asks.length) return 1;
  return Math.min(...asks.map((a) => parseFloat(a.price)));
}

export function getMidPrice(
  bids: { price: string; size: string }[],
  asks: { price: string; size: string }[],
): number {
  const bid = getBestBid(bids);
  const ask = getBestAsk(asks);
  return (bid + ask) / 2;
}
