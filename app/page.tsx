"use client";

import { useMemo, useEffect, useState } from "react";
import { useMarkets } from "@/hooks/useMarkets";
import { useBinancePrices } from "@/hooks/useBinancePrice";
import { TopNav } from "@/components/layout/TopNav";
import { SubNav } from "@/components/layout/SubNav";
import { BottomBar } from "@/components/layout/BottomBar";
import { MarketTable } from "@/components/market/MarketTable";

function getNextSessionStart(): Date {
  const now = new Date();
  const et = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const next = new Date(et);
  next.setHours(15, 25, 0, 0);
  if (et >= next) { next.setDate(next.getDate() + 1); next.setHours(15, 25, 0, 0); }
  return new Date(next.getTime() + (now.getTime() - et.getTime()));
}

function BetweenSessions() {
  const [countdown, setCountdown] = useState("");
  useEffect(() => {
    const tick = () => {
      const diff = Math.max(0, getNextSessionStart().getTime() - Date.now());
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-4">
      <div className="text-[11px] font-medium tracking-widest text-[var(--text-dim)] uppercase">
        Between Sessions
      </div>
      <div
        className="text-4xl font-semibold tabnum"
        style={{ color: "var(--accent)", fontVariantNumeric: "tabular-nums" }}
      >
        {countdown}
      </div>
      <div className="text-[12px] text-[var(--text-secondary)]">
        Next session · 3:25 PM ET · Mon–Fri
      </div>
    </div>
  );
}

export default function TerminalPage() {
  const { data: markets, isLoading, error } = useMarkets();
  const [activeAsset, setActiveAsset] = useState("All");

  const assets = useMemo(
    () => [...new Set((markets ?? []).map((m) => m.asset).filter(Boolean) as string[])],
    [markets],
  );

  const prices = useBinancePrices(assets);

  const filteredMarkets = useMemo(() => {
    if (!markets) return [];
    if (activeAsset === "All") return markets;
    return markets.filter((m) => m.asset === activeAsset);
  }, [markets, activeAsset]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopNav activeVertical="crypto" />
      <SubNav
        activeAsset={activeAsset}
        onAssetChange={setActiveAsset}
        marketCount={filteredMarkets.length}
      />

      {/* Main content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {isLoading && (
          <div className="flex items-center justify-center flex-1 gap-2 text-[12px] text-[var(--text-secondary)]">
            <span className="pulse-dot w-1.5 h-1.5 rounded-full inline-block" style={{ background: "var(--accent)" }} />
            Loading markets…
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center flex-1 text-[12px] text-[var(--red)]">
            Failed to load markets — {error.message}
          </div>
        )}

        {!isLoading && !error && filteredMarkets.length === 0 && (
          <BetweenSessions />
        )}

        {!isLoading && !error && filteredMarkets.length > 0 && (
          <MarketTable markets={filteredMarkets} prices={prices} />
        )}
      </div>

      <BottomBar prices={prices} />
    </div>
  );
}
