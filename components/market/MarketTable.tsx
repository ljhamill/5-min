"use client";

import { useMemo } from "react";
import type { PolymarketMarket } from "@/lib/polymarket/types";
import type { AssetData } from "@/hooks/useBinancePrice";
import { MarketRow } from "./MarketRow";
import { useCountdown } from "@/hooks/useCountdown";

type Props = {
  markets: PolymarketMarket[];
  prices: Record<string, AssetData>;
};

const COL_WIDTHS = {
  market:  "minmax(220px, 1fr)",
  window:  "110px",
  price:   "110px",
  mktOdds: "90px",
  model:   "90px",
  edge:    "80px",
  vol:     "70px",
  actions: "200px",
};

const GRID = Object.values(COL_WIDTHS).join(" ");

const COLUMNS = [
  { label: "Market",     id: "market"  },
  { label: "Window",     id: "window"  },
  { label: "Live Price", id: "price"   },
  { label: "Mkt Odds",   id: "mktOdds" },
  { label: "Model",      id: "model"   },
  { label: "Edge",       id: "edge"    },
  { label: "Vol (ann.)", id: "vol"     },
  { label: "Action",     id: "actions" },
];

function formatWindowTime(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/New_York",
  }) + " ET";
}

function WindowHeader({
  endDateIso,
  windowStartIso,
  count,
  isFirst,
}: {
  endDateIso: string;
  windowStartIso: string;
  count: number;
  isFirst: boolean;
}) {
  const { formatted, secondsRemaining, isUrgent } = useCountdown(endDateIso);
  const isActive = secondsRemaining > 0 && secondsRemaining <= 300;

  return (
    <div
      className="flex items-center gap-3 px-4 py-2 border-b border-[var(--border)]"
      style={{
        background: isFirst ? "var(--bg-elevated)" : "var(--bg-base)",
        borderTop: isFirst ? "none" : "1px solid var(--border)",
      }}
    >
      {/* Status badge */}
      {isActive ? (
        <span
          className="flex items-center gap-1.5 text-[10px] font-medium px-2 py-0.5 rounded-full"
          style={{ background: "var(--green-dim)", color: "var(--green)" }}
        >
          <span className="w-1.5 h-1.5 rounded-full pulse-dot" style={{ background: "var(--green)" }} />
          LIVE
        </span>
      ) : (
        <span
          className="text-[10px] font-medium px-2 py-0.5 rounded-full"
          style={{ background: "var(--bg-overlay)", color: "var(--text-dim)", border: "1px solid var(--border)" }}
        >
          UPCOMING
        </span>
      )}

      {/* Window start time */}
      <span className="text-[12px] font-medium text-[var(--text-primary)]">
        {formatWindowTime(windowStartIso)}
      </span>

      {/* Separator */}
      <span className="text-[var(--text-dim)]">·</span>

      {/* Countdown */}
      <span
        className={`tabnum text-[12px] font-medium ${
          isUrgent
            ? "text-red"
            : secondsRemaining < 3600
            ? "text-[var(--amber)]"
            : "text-[var(--text-secondary)]"
        }`}
      >
        {formatted} remaining
      </span>

      {/* Market count */}
      <span className="ml-auto text-[11px] text-[var(--text-dim)]">
        {count} market{count !== 1 ? "s" : ""}
      </span>
    </div>
  );
}

export function MarketTable({ markets, prices }: Props) {
  // Group markets by window_start_iso — same start = same 5-min window
  const windows = useMemo(() => {
    const map = new Map<string, PolymarketMarket[]>();
    for (const m of markets) {
      const key = m.window_start_iso ?? m.end_date_iso;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    // Already sorted soonest-first from the API layer
    return Array.from(map.entries());
  }, [markets]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Sticky column headers */}
      <div
        className="grid shrink-0 px-4 border-b border-[var(--border)]"
        style={{ gridTemplateColumns: GRID, background: "var(--bg-surface)" }}
      >
        {COLUMNS.map((col) => (
          <div
            key={col.id}
            className="py-2.5 text-[11px] font-medium text-[var(--text-secondary)] uppercase tracking-wide"
          >
            {col.label}
          </div>
        ))}
      </div>

      {/* Windowed rows */}
      <div className="overflow-y-auto flex-1">
        {windows.map(([key, windowMarkets], wi) => (
          <div key={key}>
            <WindowHeader
              endDateIso={windowMarkets[0].end_date_iso}
              windowStartIso={windowMarkets[0].window_start_iso ?? ""}
              count={windowMarkets.length}
              isFirst={wi === 0}
            />
            {windowMarkets.map((market, i) => (
              <MarketRow
                key={market.id}
                market={market}
                assetData={market.asset ? prices[market.asset] : undefined}
                gridTemplate={GRID}
                isEven={i % 2 === 0}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
