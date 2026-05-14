import { NextResponse } from "next/server";
import { fetchFiveMinuteMarkets } from "@/lib/polymarket/markets";

// Manual revalidation — 30s cache header so browser/CDN caches but Next.js
// doesn't try to store the full Gamma API response (>2MB) in its data cache.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const markets = await fetchFiveMinuteMarkets();
    return NextResponse.json(markets, {
      headers: { "Cache-Control": "s-maxage=30, stale-while-revalidate=10" },
    });
  } catch (err) {
    console.error("Failed to fetch markets:", err);
    return NextResponse.json({ error: "Failed to fetch markets" }, { status: 500 });
  }
}
