import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const GAMMA_API = "https://gamma-api.polymarket.com";

const ASSET_SLUGS = ["btc", "eth", "sol", "xrp", "bnb", "doge", "hype"];

const SLUG_ASSET_MAP: Record<string, string> = {
  btc:  "BTC", eth:  "ETH", sol:  "SOL", xrp:  "XRP",
  bnb:  "BNB", doge: "DOGE", hype: "HYPE",
};

function parseSlugAsset(slug: string): string | undefined {
  const prefix = slug.split("-updown-5m")[0];
  return SLUG_ASSET_MAP[prefix.toLowerCase()];
}

const WINDOW_SECONDS = 300;
// How many 5-min windows ahead (beyond the live one) to keep synced/tradeable.
const WINDOWS_AHEAD = 3;

// Bulk-listing via /events?active=true&closed=false&order=startDate&... turned out
// to be a dead end: Polymarket's Gamma API (a) interleaves thousands of unrelated
// long-running markets whose own startDate ordering has nothing to do with our
// 5-min windows, and (b) hard-errors (422) once pagination offset exceeds ~2100 —
// while our live window sits ~24h / ~2000 events deep in descending order. No
// pagination strategy can reach it reliably.
//
// Since the slug format is deterministic — `{asset}-updown-5m-{5min-aligned-unix}`
// — we can compute the exact slugs for the live window + next few windows and
// fetch each directly via /events?slug=X. Exact, fast (one request per
// asset×window, all in parallel), and immune to both problems above.
async function fetchAllFiveMinEvents(): Promise<Record<string, unknown>[]> {
  const now = Date.now();
  const currentWindowStart = Math.floor(now / 1000 / WINDOW_SECONDS) * WINDOW_SECONDS;

  const slugs: string[] = [];
  for (let w = 0; w <= WINDOWS_AHEAD; w++) {
    const windowStart = currentWindowStart + w * WINDOW_SECONDS;
    for (const asset of ASSET_SLUGS) slugs.push(`${asset}-updown-5m-${windowStart}`);
  }

  const results = await Promise.all(
    slugs.map(async (slug) => {
      try {
        const res = await fetch(`${GAMMA_API}/events?slug=${slug}`, {
          headers: { "User-Agent": "5min-terminal/1.0" },
        });
        if (!res.ok) return null;
        const data: Record<string, unknown>[] = await res.json();
        return data[0] ?? null;
      } catch {
        return null;
      }
    }),
  );

  return results.filter((e): e is Record<string, unknown> => e !== null);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const events = await fetchAllFiveMinEvents();
    const now = Date.now();

    const markets = events
      .filter((e) => {
        const market = (e.markets as Record<string, unknown>[])?.[0];
        return Boolean(market);
      })
      .map((e) => {
        const slug   = e.slug as string;
        const asset  = parseSlugAsset(slug);
        const market = (e.markets as Record<string, unknown>[])[0];

        let tokenYesId = "";
        let tokenNoId  = "";
        try {
          const ids: string[] = JSON.parse(market.clobTokenIds as string);
          tokenYesId = ids[0] ?? "";
          tokenNoId  = ids[1] ?? "";
        } catch { /* skip */ }

        let priceYes = 0.5;
        let priceNo  = 0.5;
        try {
          const prices: string[] = JSON.parse(market.outcomePrices as string);
          priceYes = parseFloat(prices[0] ?? "0.5");
          priceNo  = parseFloat(prices[1] ?? "0.5");
        } catch { /* skip */ }

        const endDate   = (e.endDate as string) ?? (market.endDate as string) ?? "";
        const startTs   = parseInt(slug.match(/updown-5m-(\d+)/)?.[1] ?? "0") * 1000;
        const windowStart = startTs ? new Date(startTs).toISOString() : null;

        // Determine status from timestamps — don't rely on API flags alone
        const endTs            = endDate ? new Date(endDate).getTime() : 0;
        const secondsRemaining = Math.max(0, Math.floor((endTs - now) / 1000));
        const status =
          secondsRemaining === 0    ? "closed"   :
          startTs > 0 && startTs <= now ? "active"   :
                                      "upcoming";

        return {
          id:               market.id as string,
          source:           "polymarket",
          source_id:        market.id as string,
          source_slug:      slug,
          market_type:      "crypto",
          title:            `${asset} Up / Down`,
          asset,
          window_start:     windowStart,
          end_date:         endDate,
          window_seconds:   300,
          token_yes_id:     tokenYesId,
          token_no_id:      tokenNoId,
          tick_size:        String(market.orderPriceMinTickSize ?? "0.01"),
          price_yes:        priceYes,
          price_no:         priceNo,
          mid_price:        (priceYes + priceNo) / 2,
          status,
          // fetchAllFiveMinEvents() only ever returns the live window + the next
          // WINDOWS_AHEAD windows (computed directly, not bulk-listed), so trusting
          // Gamma's own acceptingOrders flag here is safe — it can no longer be
          // polluted by markets 24h out the way bulk pagination was.
          accepting_orders: Boolean(market.acceptingOrders),
          metadata: {
            neg_risk:  false,
            oracle:    "chainlink",
            direction: "above",
          },
          updated_at: new Date().toISOString(),
        };
      })
      // Drop any with no endDate or unknown asset
      .filter((m) => m.end_date && m.asset);

    if (markets.length === 0) {
      return new Response(
        JSON.stringify({ synced: 0, message: "no markets found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Upsert everything we found
    const { error: upsertError } = await supabase
      .from("markets")
      .upsert(markets, { onConflict: "source,source_id" });

    if (upsertError) throw upsertError;

    // Mark closed by timestamp — don't trust the API flag, use our own calculation
    // Only close markets whose endDate has passed AND aren't in our fresh upsert set
    const activeIds = markets
      .filter((m) => m.status !== "closed")
      .map((m) => m.id);

    if (activeIds.length > 0) {
      await supabase
        .from("markets")
        .update({ status: "closed", accepting_orders: false, updated_at: new Date().toISOString() })
        .eq("source", "polymarket")
        .eq("market_type", "crypto")
        .not("id", "in", `(${activeIds.map((id) => `'${id}'`).join(",")})`)
        .lt("end_date", new Date().toISOString()); // only close if endDate is in the past
    }

    const byStatus = markets.reduce((acc, m) => {
      acc[m.status] = (acc[m.status] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return new Response(
      JSON.stringify({ synced: markets.length, byStatus, timestamp: new Date().toISOString() }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("sync-5min-markets error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
