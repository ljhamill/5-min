"use client";

import { useMemo, useEffect, useState } from "react";
import { useMarkets } from "@/hooks/useMarkets";
import { useBinancePrices } from "@/hooks/useBinancePrice";
import { TopNav } from "@/components/layout/TopNav";
import { SubNav } from "@/components/layout/SubNav";
import { BottomBar } from "@/components/layout/BottomBar";
import { MarketSidebar } from "@/components/market/MarketSidebar";
import { PriceChart } from "@/components/chart/PriceChart";
import { Orderbook } from "@/components/orderbook/Orderbook";
import { OrderTicket } from "@/components/trade/OrderTicket";
import type { PolymarketMarket } from "@/lib/polymarket/types";
import { useOrderbook } from "@/hooks/useOrderbook";

/** Bridge component: gets the YES token orderbook midPrice for the chart */
function TerminalContent({
  markets,
  prices,
  selectedMarket,
  onSelect,
}: {
  markets: PolymarketMarket[];
  prices: Record<string, import("@/hooks/useBinancePrice").AssetData>;
  selectedMarket: PolymarketMarket | null;
  onSelect: (m: PolymarketMarket) => void;
}) {
  const upToken = selectedMarket?.tokens.find((t) => t.outcome === "Yes");
  const book = useOrderbook(upToken?.token_id);
  const midPrice = book?.midPrice ?? upToken?.price ?? 0;

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left sidebar */}
      <MarketSidebar
        markets={markets}
        prices={prices}
        selectedId={selectedMarket?.id ?? null}
        onSelect={onSelect}
      />

      {/* Center column */}
      <div className="flex flex-col flex-1 overflow-hidden border-l border-[var(--border)]">
        <PriceChart
          asset={selectedMarket?.asset}
          marketEndIso={selectedMarket?.end_date_iso}
          midPrice={midPrice}
        />
        <Orderbook tokenId={upToken?.token_id} />
      </div>

      {/* Right panel */}
      <OrderTicket
        market={selectedMarket}
        assetData={selectedMarket?.asset ? prices[selectedMarket.asset] : undefined}
      />
    </div>
  );
}

export default function TerminalPage() {
  const { data: markets, isLoading, error } = useMarkets();
  const [activeAsset, setActiveAsset] = useState("All");
  const [selectedMarket, setSelectedMarket] = useState<PolymarketMarket | null>(null);

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

  // Auto-select first market when markets load
  useEffect(() => {
    if (filteredMarkets.length > 0 && selectedMarket === null) {
      setSelectedMarket(filteredMarkets[0]);
    }
  }, [filteredMarkets, selectedMarket]);

  // If selected market is no longer in filtered list, clear selection
  useEffect(() => {
    if (selectedMarket && !filteredMarkets.find((m) => m.id === selectedMarket.id)) {
      setSelectedMarket(filteredMarkets[0] ?? null);
    }
  }, [filteredMarkets, selectedMarket]);

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
          <div className="flex items-center justify-center flex-1 text-[12px] text-[var(--text-secondary)]">
            No markets available
          </div>
        )}

        {!isLoading && !error && filteredMarkets.length > 0 && (
          <TerminalContent
            markets={filteredMarkets}
            prices={prices}
            selectedMarket={selectedMarket}
            onSelect={setSelectedMarket}
          />
        )}
      </div>

      <BottomBar prices={prices} />
    </div>
  );
}
