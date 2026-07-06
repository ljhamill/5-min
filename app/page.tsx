"use client";

import { useMemo, useEffect, useState } from "react";
import { useMarkets } from "@/hooks/useMarkets";
import { useAssetPricesMap } from "@/hooks/useAssetPrices";
import { TopNav } from "@/components/layout/TopNav";
import { SubNav } from "@/components/layout/SubNav";
import { BottomBar } from "@/components/layout/BottomBar";
import { MarketSidebar } from "@/components/market/MarketSidebar";
import { PriceChart } from "@/components/chart/PriceChart";
import { Orderbook } from "@/components/orderbook/Orderbook";
import { OrderTicket } from "@/components/trade/OrderTicket";
import type { PolymarketMarket } from "@/lib/polymarket/types";

function TerminalContent({
  markets,
  prices,
  selectedMarket,
  onSelect,
}: {
  markets: PolymarketMarket[];
  prices: Record<string, import("@/hooks/useAssetPrices").AssetData>;
  selectedMarket: PolymarketMarket | null;
  onSelect: (m: PolymarketMarket) => void;
}) {
  const [selectedSide, setSelectedSide] = useState<"YES" | "NO">("YES");

  // Reset to the Up side whenever the selected market changes
  useEffect(() => {
    setSelectedSide("YES");
  }, [selectedMarket?.id]);

  const upToken = selectedMarket?.tokens.find((t) => t.outcome === "Yes");
  const downToken = selectedMarket?.tokens.find((t) => t.outcome === "No");
  const bookTokenId = selectedSide === "YES" ? upToken?.token_id : downToken?.token_id;

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
        <PriceChart market={selectedMarket} />
        <Orderbook tokenId={bookTokenId} side={selectedSide} />
      </div>

      {/* Right panel */}
      <OrderTicket
        market={selectedMarket}
        assetData={selectedMarket?.asset ? prices[selectedMarket.asset] : undefined}
        selectedSide={selectedSide}
        onSelectSide={setSelectedSide}
      />
    </div>
  );
}

export default function TerminalPage() {
  const { data: markets, isLoading, error } = useMarkets();
  const [activeAsset, setActiveAsset] = useState("All");
  const [selectedMarket, setSelectedMarket] = useState<PolymarketMarket | null>(null);

  const prices = useAssetPricesMap();

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
