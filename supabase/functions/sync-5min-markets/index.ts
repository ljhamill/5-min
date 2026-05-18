import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const GAMMA_API = "https://gamma-api.polymarket.com";

const SLUG_ASSET_MAP: Record<string, string> = {
  btc:  "BTC", eth:  "ETH", sol:  "SOL", xrp:  "XRP",
  bnb:  "BNB", doge: "DOGE", hype: "HYPE", ada:  "ADA",
};

function parseSlugAsset(slug: string): string | undefined {
  const prefix = slug.split("-updown-5m")[0];
  return SLUG_ASSET_MAP[prefix.toLowerCase()];
}

// Gamma API caps at 100 results — paginate to get all windows
async function fetchAllFiveMinEvents(): Promise<Record<string, unknown>[]> {
  const all: Record<string, unknown>[] = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const url = `${GAMMA_API}/events?active=true&closed=false&limit=${limit}&offset=${offset}&order=startDate&ascending=false`;
    const res = await fetch(url, { headers: { "User-Agent": "5min-terminal/1.0" } });
    if (!res.ok) throw new Error(`Gamma API ${res.status}`);

    const page: Record<string, unknown>[] = await res.json();
    if (!page.length) break;

    const fiveMin = page.filter((e) => (e.slug as string)?.includes("updown-5m"));
    all.push(...fiveMin);

    // Stop paginating if we've gone far enough back in time:
    // if the oldest event on this page started more than 48h ago, we have everything relevant
    const oldest = page[page.length - 1];
    const oldestStart = oldest?.startDate as string;
    if (oldestStart) {
      const oldestTs = new Date(oldestStart).getTime();
      if (Date.now() - oldestTs > 48 * 60 * 60 * 1000) break;
    }

    // If we got fewer results than the limit, we've reached the end
    if (page.length < limit) break;

    offset += limit;

    // Safety: don't paginate more than 10 pages (1000 events)
    if (offset >= 1000) break;
  }

  return all;
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
