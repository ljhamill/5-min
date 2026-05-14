"use client";

import { useMemo, useEffect, useState } from "react";
import { useMarkets } from "@/hooks/useMarkets";
import { useBinancePrices } from "@/hooks/useBinancePrice";
import { MarketCard } from "@/components/market/MarketCard";
import { Header } from "@/components/layout/Header";

// Markets run ~3:25 PM – 4:50 PM ET on trading days
function getNextSessionStart(): Date {
  const now = new Date();
  const et = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const next = new Date(et);
  // If before 3:25 PM today, next session is today at 3:25
  // If after 4:50 PM today, next session is tomorrow at 3:25
  next.setHours(15, 25, 0, 0);
  if (et >= next) {
    next.setDate(next.getDate() + 1);
    next.setHours(15, 25, 0, 0);
  }
  // Convert back to UTC offset
  const diffMs = now.getTime() - et.getTime();
  return new Date(next.getTime() + diffMs);
}

function NoMarketsState() {
  const [countdown, setCountdown] = useState("");
  useEffect(() => {
    function update() {
      const diff = Math.max(0, getNextSessionStart().getTime() - Date.now());
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(
        `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`,
      );
    }
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-48 gap-3">
      <div className="text-xs text-[var(--text-secondary)]">BETWEEN SESSIONS</div>
      <div className="text-2xl tabular-nums text-[var(--amber)]">{countdown}</div>
      <div className="text-[10px] text-[var(--text-dim)]">
        NEXT SESSION · 3:25 PM ET · MON–FRI
      </div>
    </div>
  );
}

export default function TerminalPage() {
  const { data: markets, isLoading, error } = useMarkets();

  const assets = useMemo(
    () => [...new Set((markets ?? []).map((m) => m.asset).filter(Boolean) as string[])],
    [markets],
  );

  const priceData = useBinancePrices(assets);

  const tickers = useMemo(
    () =>
      Object.entries(priceData).map(([asset, data]) => ({
        asset,
        price: data.price,
        prevPrice: data.prevPrice,
      })),
    [priceData],
  );

  return (
    <div className="flex flex-col h-full">
      <Header tickers={tickers} />

      <main className="flex-1 overflow-auto p-4">
        {isLoading && (
          <div className="flex items-center justify-center h-32 text-[var(--text-secondary)] text-xs">
            <span className="blink mr-2">●</span>
            LOADING MARKETS...
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center h-32 text-[var(--red)] text-xs">
            FAILED TO LOAD MARKETS — {error.message}
          </div>
        )}

        {markets && markets.length === 0 && (
          <NoMarketsState />
        )}

        {markets && markets.length > 0 && (
          <>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-[10px] text-[var(--text-secondary)]">
                {markets.length} ACTIVE MARKET{markets.length !== 1 ? "S" : ""}
              </span>
              <span className="text-[var(--text-dim)]">·</span>
              <span className="text-[10px] text-[var(--text-dim)]">
                5-MINUTE CRYPTO · POLYMARKET
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
              {markets.map((market) => (
                <MarketCard
                  key={market.id}
                  market={market}
                  assetData={market.asset ? priceData[market.asset] : undefined}
                />
              ))}
            </div>
          </>
        )}
      </main>

      <footer className="border-t border-[var(--border)] px-4 py-1.5 flex items-center gap-4 text-[10px] text-[var(--text-dim)]">
        <span>POLYGON NETWORK</span>
        <span>·</span>
        <span>POWERED BY POLYMARKET</span>
      </footer>
    </div>
  );
}
