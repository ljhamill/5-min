"use client";

import type { PolymarketMarket } from "@/lib/polymarket/types";
import type { AssetData } from "@/hooks/useBinancePrice";
import { MarketRow } from "./MarketRow";

type Props = {
  markets: PolymarketMarket[];
  prices: Record<string, AssetData>;
};

const COL_WIDTHS = {
  market:   "minmax(220px, 1fr)",
  window:   "110px",
  price:    "110px",
  mktOdds:  "90px",
  model:    "90px",
  edge:     "80px",
  vol:      "70px",
  actions:  "200px",
};

const GRID = Object.values(COL_WIDTHS).join(" ");

export function MarketTable({ markets, prices }: Props) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Sticky column headers */}
      <div
        className="grid shrink-0 px-4 border-b border-[var(--border)]"
        style={{ gridTemplateColumns: GRID, background: "var(--bg-surface)" }}
      >
        {[
          { label: "Market", id: "market" },
          { label: "Window", id: "window" },
          { label: "Live Price", id: "price" },
          { label: "Mkt Odds", id: "mktOdds" },
          { label: "Model", id: "model" },
          { label: "Edge", id: "edge" },
          { label: "Vol (ann.)", id: "vol" },
          { label: "Action", id: "actions" },
        ].map((col) => (
          <div
            key={col.id}
            className="py-2.5 text-[11px] font-medium text-[var(--text-secondary)] uppercase tracking-wide"
          >
            {col.label}
          </div>
        ))}
      </div>

      {/* Rows */}
      <div className="overflow-y-auto flex-1">
        {markets.map((market, i) => (
          <MarketRow
            key={market.id}
            market={market}
            assetData={market.asset ? prices[market.asset] : undefined}
            gridTemplate={GRID}
            isEven={i % 2 === 0}
          />
        ))}
      </div>
    </div>
  );
}
