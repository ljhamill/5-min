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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const res = await fetch(
      `${GAMMA_API}/events?active=true&closed=false&limit=200&order=startDate&ascending=false`,
      { headers: { "User-Agent": "5min-terminal/1.0" } },
    );

    if (!res.ok) throw new Error(`Gamma API ${res.status}`);

    const events: Record<string, unknown>[] = await res.json();
    const now = Date.now();

    const markets = events
      .filter((e) => {
        const slug = (e.slug as string) ?? "";
        const market = (e.markets as Record<string, unknown>[])?.[0];
        return (
          slug.includes("updown-5m") &&
          Boolean(market) &&
          Boolean(market.acceptingOrders)
        );
      })
      .map((e) => {
        const slug = e.slug as string;
        const asset = parseSlugAsset(slug);
        const market = (e.markets as Record<string, unknown>[])[0];

        let tokenYesId = "";
        let tokenNoId = "";
        try {
          const ids: string[] = JSON.parse(market.clobTokenIds as string);
          tokenYesId  = ids[0] ?? "";
          tokenNoId   = ids[1] ?? "";
        } catch { /* skip */ }

        let priceYes = 0.5;
        let priceNo  = 0.5;
        try {
          const prices: string[] = JSON.parse(market.outcomePrices as string);
          priceYes = parseFloat(prices[0] ?? "0.5");
          priceNo  = parseFloat(prices[1] ?? "0.5");
        } catch { /* skip */ }

        const endDate    = (e.endDate as string) ?? (market.endDate as string) ?? "";
        const startTs    = parseInt(slug.match(/updown-5m-(\d+)/)?.[1] ?? "0") * 1000;
        const windowStart = startTs ? new Date(startTs).toISOString() : null;
        const secondsRemaining = Math.max(0, Math.floor((new Date(endDate).getTime() - now) / 1000));
        const status = secondsRemaining === 0 ? "closed" : startTs <= now ? "active" : "upcoming";

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
            neg_risk: false,
            oracle:   "chainlink",
            direction: "above",
          },
          updated_at: new Date().toISOString(),
        };
      });

    if (markets.length === 0) {
      return new Response(JSON.stringify({ synced: 0, message: "no markets found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Upsert all active markets
    const { error: upsertError } = await supabase
      .from("markets")
      .upsert(markets, { onConflict: "source,source_id" });

    if (upsertError) throw upsertError;

    // Mark markets no longer in the active set as closed
    const activeIds = markets.map((m) => m.id);
    await supabase
      .from("markets")
      .update({ status: "closed", accepting_orders: false, updated_at: new Date().toISOString() })
      .eq("source", "polymarket")
      .eq("market_type", "crypto")
      .not("id", "in", `(${activeIds.map((id) => `'${id}'`).join(",")})`);
      // Only mark as closed if they were previously active/upcoming

    return new Response(
      JSON.stringify({ synced: markets.length, timestamp: new Date().toISOString() }),
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
