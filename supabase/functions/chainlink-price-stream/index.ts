import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { calcProbability } from "../_shared/probability.ts";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const RUN_DURATION      = 55_000; // ms — stay under Edge Function timeout
const POLL_INTERVAL     = 1_000;  // ms — poll all feeds every second
const DB_WRITE_INTERVAL = 5_000;  // ms — batch DB writes

// ---------------------------------------------------------------------------
// Chainlink on-chain feeds — Polygon mainnet (confirmed via PolygonScan)
// latestRoundData() selector: 0xfeaf968c
// Answer decimals: 8  →  divide by 1e8
// Docs: https://docs.chain.link/data-feeds/price-feeds/addresses?network=polygon
// ---------------------------------------------------------------------------
const POLYGON_RPC = "https://polygon-bor-rpc.publicnode.com";
const LATEST_ROUND_DATA = "0xfeaf968c";

const CHAINLINK_FEEDS: Record<string, string> = {
  BTC: "0xc907E116054Ad103354f2D350FD2514433D57F6f",
  ETH: "0xF9680D99D6C9589e2a93a78A04A279e509205945",
  BNB: "0x82a6c4AF830caa6c97bb504425f6a66165c2C26e",
};

// ---------------------------------------------------------------------------
// Pyth Hermes — free REST oracle, no auth
// Feed IDs confirmed via https://hermes.pyth.network/v2/price_feeds
// Docs: https://docs.pyth.network/price-feeds
// ---------------------------------------------------------------------------
const PYTH_HERMES = "https://hermes.pyth.network/v2/updates/price/latest";

const PYTH_FEEDS: Record<string, string> = {
  SOL:  "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
  DOGE: "0xdcef50dd0a4cd2dcc17e45df1676dcb336a11a61c69df7a0299b0150c672d25c",
  XRP:  "0xec5d399846a9209f3fe5881d70aae9268c94339ff9817e8d18ff19fa05eea1c8",
  HYPE: "0x4279e31cc369bbcc2faf022b382b080e32a8e689ff20fbc530d2a603eb6cd98b",
};

// ---------------------------------------------------------------------------
// Helpers — Chainlink
// ---------------------------------------------------------------------------

/** ABI-decode latestRoundData() response → USD price */
function decodeLatestRoundData(hex: string): number | null {
  // Layout (each 32 bytes): roundId | answer | startedAt | updatedAt | answeredInRound
  const data = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (data.length < 128) return null;
  const answerHex = data.slice(64, 128); // second word = int256 answer
  const raw = BigInt("0x" + answerHex);
  // Handle two's complement for negative int256 (shouldn't happen for prices)
  const signed = raw > (1n << 255n) ? raw - (1n << 256n) : raw;
  const price = Number(signed) / 1e8;
  return price > 0 ? price : null;
}

async function fetchChainlinkPrice(address: string): Promise<number | null> {
  try {
    const res = await fetch(POLYGON_RPC, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        jsonrpc: "2.0",
        method:  "eth_call",
        params:  [{ to: address, data: LATEST_ROUND_DATA }, "latest"],
        id:      1,
      }),
    });
    if (!res.ok) return null;
    const { result, error } = await res.json();
    if (error || !result) return null;
    return decodeLatestRoundData(result);
  } catch {
    return null;
  }
}

async function fetchChainlinkPrices(): Promise<Record<string, number>> {
  const results = await Promise.all(
    Object.entries(CHAINLINK_FEEDS).map(async ([asset, addr]) => {
      const price = await fetchChainlinkPrice(addr);
      return [asset, price] as [string, number | null];
    }),
  );
  return Object.fromEntries(results.filter(([, p]) => p !== null)) as Record<string, number>;
}

// ---------------------------------------------------------------------------
// Helpers — Pyth Hermes
// ---------------------------------------------------------------------------

async function fetchPythPrices(): Promise<Record<string, number>> {
  try {
    const qs  = Object.values(PYTH_FEEDS).map((id) => `ids[]=${id}`).join("&");
    const res = await fetch(`${PYTH_HERMES}?${qs}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return {};

    const json = await res.json();
    const idToAsset = Object.fromEntries(
      Object.entries(PYTH_FEEDS).map(([asset, id]) => [id.toLowerCase().replace("0x", ""), asset]),
    );

    const out: Record<string, number> = {};
    for (const item of json.parsed ?? []) {
      const asset = idToAsset[item.id.toLowerCase()];
      if (!asset) continue;
      const price = parseFloat(item.price.price) * Math.pow(10, item.price.expo);
      if (price > 0) out[asset] = price;
    }
    return out;
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// Vol / drift helpers (identical to former binance-price-stream)
// ---------------------------------------------------------------------------

const VOL_WINDOW   = 60;
const DRIFT_WINDOW = 30;

function calcRealizedVol(prices: number[]): number {
  if (prices.length < 2) return 0.8;
  const returns = prices.slice(1).map((p, i) => Math.log(p / prices[i]));
  const mean     = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / returns.length;
  return Math.sqrt(variance * 365.25 * 24 * 3600); // annualised from per-second ticks
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Fetch active markets at startup for probability calculations
  const { data: activeMarkets } = await supabase
    .from("markets")
    .select("id, asset, end_date, token_yes_id, metadata")
    .eq("source", "polymarket")
    .in("status", ["active", "upcoming"])
    .eq("accepting_orders", true);

  const markets = activeMarkets ?? [];

  // Rolling price history + latest snapshot per asset
  const priceHistory: Record<string, number[]> = {};
  const latestData:   Record<string, {
    price: number; prevPrice: number; volAnn: number; drift30s: number;
  }> = {};

  // Supabase Realtime broadcast channel
  const channel = supabase.channel("asset-prices");
  await channel.subscribe();

  let lastDbWrite = Date.now();
  const startTime = Date.now();

  // ---------------------------------------------------------------------------
  // Poll loop — every POLL_INTERVAL ms for RUN_DURATION ms
  // ---------------------------------------------------------------------------
  while (Date.now() - startTime < RUN_DURATION) {
    const tickStart = Date.now();

    // Fetch Chainlink + Pyth in parallel
    const [chainlinkPrices, pythPrices] = await Promise.all([
      fetchChainlinkPrices(),
      fetchPythPrices(),
    ]);

    const allPrices: Record<string, number> = { ...chainlinkPrices, ...pythPrices };
    const now = Date.now();
    const probUpdates: Record<string, { prob: number; edge: number }> = {};

    for (const [asset, price] of Object.entries(allPrices)) {
      const prev = latestData[asset]?.price ?? price;

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

      // Compute probabilities for all markets of this asset
      for (const m of markets.filter((m) => m.asset === asset)) {
        const secondsRemaining = Math.max(
          0,
          Math.floor((new Date(m.end_date).getTime() - now) / 1000),
        );
        const result = calcProbability({
          currentPrice:         price,
          strikePrice:          price, // Up/Down: S = K
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

      // Broadcast immediately to browser subscribers
      channel.send({
        type:  "broadcast",
        event: "price",
        payload: { asset, price, prevPrice: prev, volAnn, drift30s, probUpdates, ts: now },
      });
    }

    // Batch DB write every 5s
    if (now - lastDbWrite >= DB_WRITE_INTERVAL) {
      lastDbWrite = now;
      flushToDb(supabase, latestData, markets, probUpdates);
    }

    // Sleep until next tick
    const sleep = Math.max(0, POLL_INTERVAL - (Date.now() - tickStart));
    if (sleep > 0) await new Promise<void>((r) => setTimeout(r, sleep));
  }

  await supabase.removeChannel(channel);

  return new Response(
    JSON.stringify({ ok: true, duration: RUN_DURATION, assets: Object.keys(latestData) }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});

// ---------------------------------------------------------------------------
// DB flush — same schema as former binance-price-stream
// ---------------------------------------------------------------------------

async function flushToDb(
  supabase:    ReturnType<typeof createClient>,
  latestData:  Record<string, { price: number; prevPrice: number; volAnn: number; drift30s: number }>,
  markets:     Record<string, unknown>[],
  probUpdates: Record<string, { prob: number; edge: number }>,
) {
  const now = new Date().toISOString();

  // Upsert asset_prices
  const priceRows = Object.entries(latestData).map(([asset, d]) => ({
    asset,
    price_source: CHAINLINK_FEEDS[asset] ? "chainlink" : "pyth",
    price:        d.price,
    price_prev:   d.prevPrice,
    vol_ann:      d.volAnn,
    drift_30s:    d.drift30s,
    updated_at:   now,
  }));

  if (priceRows.length) {
    await supabase.from("asset_prices").upsert(priceRows, { onConflict: "asset" });
  }

  // Update model_prob per market
  for (const market of markets) {
    const update = probUpdates[market.id as string];
    if (!update) continue;

    await supabase
      .from("markets")
      .update({ model_prob: update.prob, edge: update.edge, updated_at: now })
      .eq("id", market.id);
  }

  // Append prob ticks for the market graph's history seed (insert-only —
  // see market_ticks table comment in schema.sql for why this replaced the
  // old prob_history read-modify-write, which lost most writes to a race).
  const tickRows = Object.entries(probUpdates).map(([marketId, u]) => ({
    market_id: marketId,
    model_prob: u.prob,
  }));

  if (tickRows.length) {
    await supabase.from("market_ticks").insert(tickRows);
  }
}
