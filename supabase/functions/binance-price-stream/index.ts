import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { calcProbability } from "../_shared/probability.ts";

const BINANCE_SYMBOLS: Record<string, string> = {
  BTC: "btcusdt", ETH: "ethusdt", SOL: "solusdt", XRP: "xrpusdt",
  BNB: "bnbusdt", DOGE: "dogeusdt", HYPE: "hypeusdt", ADA: "adausdt",
};

const VOL_WINDOW   = 60; // ticks for annualised vol
const DRIFT_WINDOW = 30; // ticks for momentum signal
const RUN_DURATION = 55_000; // ms — stay under Edge Function timeout
const DB_WRITE_INTERVAL = 5_000; // ms between DB upserts

function calcRealizedVol(prices: number[]): number {
  if (prices.length < 2) return 0.8; // fallback
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    returns.push(Math.log(prices[i] / prices[i - 1]));
  }
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / returns.length;
  const ticksPerYear = 365.25 * 24 * 3600; // annualise from per-second ticks
  return Math.sqrt(variance * ticksPerYear);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Fetch active markets once at startup for probability calculations
  const { data: activeMarkets } = await supabase
    .from("markets")
    .select("id, asset, end_date, token_yes_id, metadata, prob_history")
    .eq("source", "polymarket")
    .in("status", ["active", "upcoming"])
    .eq("accepting_orders", true);

  const markets = activeMarkets ?? [];

  // Rolling price history per asset
  const priceHistory: Record<string, number[]> = {};
  const latestData: Record<string, {
    price: number; prevPrice: number; volAnn: number; drift30s: number;
  }> = {};

  // Supabase Realtime channel for broadcasting prices
  const channel = supabase.channel("asset-prices");
  await channel.subscribe();

  // Connect to Binance combined stream for all assets
  const streams = Object.values(BINANCE_SYMBOLS)
    .map((s) => `${s}@trade`)
    .join("/");
  const ws = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streams}`);

  let lastDbWrite = Date.now();
  const startTime = Date.now();

  ws.onmessage = (event) => {
    try {
      const { data: payload } = JSON.parse(event.data);
      if (!payload || payload.e !== "trade") return;

      const symbol = payload.s as string; // e.g. "BTCUSDT"
      const asset  = Object.entries(BINANCE_SYMBOLS).find(
        ([, sym]) => sym.toUpperCase() === symbol,
      )?.[0];
      if (!asset) return;

      const price = parseFloat(payload.p);
      const prev  = latestData[asset]?.price ?? price;

      // Update rolling history
      const history = priceHistory[asset] ?? [];
      history.push(price);
      if (history.length > VOL_WINDOW) history.shift();
      priceHistory[asset] = history;

      const volAnn   = calcRealizedVol(history);
      const drift30s = history.length >= DRIFT_WINDOW
        ? Math.log(price / history[history.length - DRIFT_WINDOW])
        : 0;

      latestData[asset] = { price, prevPrice: prev, volAnn, drift30s };

      // Compute probabilities for all markets using this asset
      const assetMarkets = markets.filter((m) => m.asset === asset);
      const probUpdates: Record<string, { prob: number; edge: number }> = {};

      for (const m of assetMarkets) {
        const secondsRemaining = Math.max(
          0,
          Math.floor((new Date(m.end_date).getTime() - Date.now()) / 1000),
        );
        const result = calcProbability({
          currentPrice:         price,
          strikePrice:          price, // Up/Down markets: S = K
          direction:            (m.metadata?.direction ?? "above") as "above" | "below",
          secondsRemaining,
          annualizedVolatility: volAnn,
          recentDrift:          drift30s,
        });
        if (result.isValid) {
          probUpdates[m.id] = {
            prob: result.modelProbability,
            edge: result.modelProbability - (m.metadata?.midPrice ?? 0.5),
          };
        }
      }

      // Broadcast immediately to all browser subscribers
      channel.send({
        type:  "broadcast",
        event: "price",
        payload: {
          asset,
          price,
          prevPrice:  prev,
          volAnn,
          drift30s,
          probUpdates, // { [marketId]: { prob, edge } }
          ts: Date.now(),
        },
      });

      // Batch DB write every 5 seconds
      const now = Date.now();
      if (now - lastDbWrite >= DB_WRITE_INTERVAL) {
        lastDbWrite = now;
        flushToDb(supabase, latestData, markets, probUpdates);
      }
    } catch (err) {
      console.error("tick error:", err);
    }
  };

  ws.onerror = (e) => console.error("Binance WS error:", e);

  // Run for RUN_DURATION then clean up
  await new Promise<void>((resolve) => setTimeout(resolve, RUN_DURATION));

  ws.close();
  await supabase.removeChannel(channel);

  return new Response(
    JSON.stringify({ ok: true, duration: RUN_DURATION, assets: Object.keys(latestData) }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});

async function flushToDb(
  supabase: ReturnType<typeof createClient>,
  latestData: Record<string, { price: number; prevPrice: number; volAnn: number; drift30s: number }>,
  markets: Record<string, unknown>[],
  probUpdates: Record<string, { prob: number; edge: number }>,
) {
  const now = new Date().toISOString();

  // Upsert asset_prices
  const priceRows = Object.entries(latestData).map(([asset, d]) => ({
    asset,
    price_source: "binance",
    price:        d.price,
    price_prev:   d.prevPrice,
    vol_ann:      d.volAnn,
    drift_30s:    d.drift30s,
    updated_at:   now,
  }));

  if (priceRows.length) {
    await supabase.from("asset_prices").upsert(priceRows, { onConflict: "asset" });
  }

  // Update model_prob, edge, append to prob_history for each market
  for (const market of markets) {
    const update = probUpdates[market.id as string];
    if (!update) continue;

    const currentHistory: { ts: number; prob: number; mid: number }[] =
      (market.prob_history as typeof currentHistory) ?? [];

    // Append new snapshot, cap at window_seconds entries (300 at 1s, 60 at 5s)
    const newEntry = { ts: Date.now(), prob: update.prob, mid: 0.5 };
    const updated  = [...currentHistory, newEntry].slice(-60); // keep last 60 (5s × 60 = 5 min)

    await supabase
      .from("markets")
      .update({
        model_prob:   update.prob,
        edge:         update.edge,
        prob_history: updated,
        updated_at:   now,
      })
      .eq("id", market.id);
  }
}
