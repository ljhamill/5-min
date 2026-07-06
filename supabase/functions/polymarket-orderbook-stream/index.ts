import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const CLOB_WS = "wss://ws-subscriptions-clob.polymarket.com/ws/market";
const RUN_DURATION    = 55_000;
const DB_WRITE_INTERVAL = 5_000;
const PING_INTERVAL   = 5_000;

type Level = { price: string; size: string };

type OrderbookState = {
  bids:     Level[];
  asks:     Level[];
  bestBid:  number;
  bestAsk:  number;
  midPrice: number;
  spread:   number;
};

function getBestBid(bids: Level[]): number {
  if (!bids.length) return 0;
  return Math.max(...bids.map((b) => parseFloat(b.price)));
}

function getBestAsk(asks: Level[]): number {
  if (!asks.length) return 1;
  return Math.min(...asks.map((a) => parseFloat(a.price)));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Fetch all active YES token IDs
  const { data: activeMarkets } = await supabase
    .from("markets")
    .select("id, token_yes_id, token_no_id, asset")
    .eq("source", "polymarket")
    .in("status", ["active", "upcoming"])
    .eq("accepting_orders", true);

  const markets = activeMarkets ?? [];
  const tokenToMarket: Record<string, string> = {};
  const isYesToken: Record<string, boolean> = {};
  for (const m of markets) {
    if (m.token_yes_id) {
      tokenToMarket[m.token_yes_id] = m.id;
      isYesToken[m.token_yes_id] = true;
    }
    if (m.token_no_id) {
      tokenToMarket[m.token_no_id] = m.id;
      isYesToken[m.token_no_id] = false;
    }
  }

  // Subscribe to both sides — the Up (YES) and Down (NO) books are
  // independent order books, not simple mirrors of each other, so the Down
  // side needs its own live feed rather than being derived as 1 - YES price.
  const tokenIds = markets
    .flatMap((m) => [m.token_yes_id, m.token_no_id])
    .filter(Boolean) as string[];

  if (!tokenIds.length) {
    return new Response(JSON.stringify({ ok: true, message: "no active tokens" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Latest orderbook state per token
  const books: Record<string, OrderbookState> = {};

  // Broadcast channel
  const channel = supabase.channel("orderbook");
  await channel.subscribe();

  const ws = new WebSocket(CLOB_WS);
  let lastDbWrite = Date.now();

  ws.onopen = () => {
    // Subscribe to all YES tokens. Verified against the live CLOB WS directly —
    // the previously used shape ({auth:{}, markets, type:"Market"}) silently
    // never returns any messages; this is the format that actually works.
    ws.send(JSON.stringify({
      assets_ids: tokenIds,
      type:       "market",
    }));
  };

  ws.onmessage = (event) => {
    try {
      const msg    = JSON.parse(event.data);
      const events = Array.isArray(msg) ? msg : [msg];

      for (const evt of events) {
        if (evt.event_type !== "book" && evt.event_type !== "price_change") continue;

        const tokenId = evt.asset_id as string;
        if (!tokenId) continue;

        if (evt.event_type === "book") {
          // The CLOB sends bids ascending (worst/lowest-price first) and asks
          // descending (worst/highest-price first). Slicing the raw arrays
          // to the first 10 elements therefore kept the WORST 10 levels on
          // each side and silently discarded the real top of book — best_bid
          // ended up being whatever price sat 10 levels up from the bottom
          // (often exactly 10¢), never the market's actual best bid. Sort to
          // the best side first, then slice.
          const bids: Level[] = [...(evt.bids ?? [])]
            .sort((a, b) => parseFloat(b.price) - parseFloat(a.price))
            .slice(0, 10);
          const asks: Level[] = [...(evt.asks ?? [])]
            .sort((a, b) => parseFloat(a.price) - parseFloat(b.price))
            .slice(0, 10);
          const bestBid  = getBestBid(bids);
          const bestAsk  = getBestAsk(asks);
          const midPrice = (bestBid + bestAsk) / 2;

          books[tokenId] = {
            bids, asks, bestBid, bestAsk, midPrice,
            spread: bestAsk - bestBid,
          };

          // Broadcast immediately
          channel.send({
            type:  "broadcast",
            event: "orderbook",
            payload: { tokenId, marketId: tokenToMarket[tokenId], ...books[tokenId], ts: Date.now() },
          });
        }
      }

      // Batch DB write every 5s
      const now = Date.now();
      if (now - lastDbWrite >= DB_WRITE_INTERVAL) {
        lastDbWrite = now;
        flushToDb(supabase, books, tokenToMarket, isYesToken);
      }
    } catch (err) {
      console.error("orderbook message error:", err);
    }
  };

  ws.onerror = (e) => console.error("CLOB WS error:", e);

  // Keep-alive pings
  const pingTimer = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) ws.send("PING");
  }, PING_INTERVAL);

  await new Promise<void>((resolve) => setTimeout(resolve, RUN_DURATION));

  clearInterval(pingTimer);
  ws.close();
  await supabase.removeChannel(channel);

  return new Response(
    JSON.stringify({ ok: true, tokens: tokenIds.length }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});

async function flushToDb(
  supabase: ReturnType<typeof createClient>,
  books:          Record<string, OrderbookState>,
  tokenToMarket:  Record<string, string>,
  isYesToken:     Record<string, boolean>,
) {
  const now = new Date().toISOString();
  const rows = Object.entries(books).map(([tokenId, b]) => ({
    token_id:   tokenId,
    market_id:  tokenToMarket[tokenId] ?? null,
    source:     "polymarket",
    bids:       b.bids,
    asks:       b.asks,
    best_bid:   b.bestBid,
    best_ask:   b.bestAsk,
    mid_price:  b.midPrice,
    spread:     b.spread,
    updated_at: now,
  }));

  if (rows.length) {
    await supabase
      .from("orderbook_state")
      .upsert(rows, { onConflict: "token_id" });
  }

  // Append mid-price ticks for the market graph's history seed. Now that both
  // YES and NO tokens are subscribed, only insert the YES (Up) side here —
  // the "Market" chart series specifically means the Up price, not either side.
  const tickRows = rows
    .filter((r) => r.market_id && isYesToken[r.token_id])
    .map((r) => ({ market_id: r.market_id as string, mid_price: r.mid_price }));

  if (tickRows.length) {
    await supabase.from("market_ticks").insert(tickRows);
  }
}
