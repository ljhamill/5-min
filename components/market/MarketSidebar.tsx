"use client";

import { useMemo } from "react";
import { useCountdown } from "@/hooks/useCountdown";
import type { PolymarketMarket } from "@/lib/polymarket/types";
import type { AssetData } from "@/hooks/useBinancePrice";
import { calcProbability, calcEdge } from "@/lib/probability/engine";

const ASSET_ICONS: Record<string, string> = {
  BTC: "₿",
  ETH: "Ξ",
  SOL: "◎",
  XRP: "✕",
  BNB: "B",
  DOGE: "Ð",
  HYPE: "H",
  ADA: "₳",
};

type Props = {
  markets: PolymarketMarket[];
  prices: Record<string, AssetData>;
  selectedId: string | null;
  onSelect: (market: PolymarketMarket) => void;
};

function formatWindowTime(iso: string): string {
  if (!iso) return "—";
  return (
    new Date(iso).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "America/New_York",
    }) + " ET"
  );
}

function fmt(price: number): string {
  if (price >= 10000)
    return `$${price.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (price >= 1)
    return `$${price.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  return `$${price.toFixed(4)}`;
}

function EdgeBadge({ edge }: { edge: number }) {
  const pct = (edge * 100).toFixed(1);
  const isPos = edge > 0.02;
  const isNeg = edge < -0.02;
  if (!isPos && !isNeg) {
    return <span style={{ color: "var(--text-dim)" }}>—</span>;
  }
  return (
    <span
      className="inline-flex items-center px-1 py-0.5 rounded text-[10px] font-medium tabnum"
      style={{
        background: isPos ? "var(--green-dim)" : "var(--red-dim)",
        color: isPos ? "var(--green)" : "var(--red)",
      }}
    >
      {edge > 0 ? "+" : ""}
      {pct}%
    </span>
  );
}

function WindowGroupHeader({
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
      className="flex items-center gap-1.5 px-3 py-1.5 border-b border-[var(--border)]"
      style={{
        background: isFirst ? "var(--bg-elevated)" : "var(--bg-surface)",
        borderTop: isFirst ? "none" : "1px solid var(--border)",
      }}
    >
      {isActive ? (
        <span
          className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0"
          style={{ background: "var(--green-dim)", color: "var(--green)" }}
        >
          <span
            className="w-1 h-1 rounded-full pulse-dot shrink-0"
            style={{ background: "var(--green)" }}
          />
          LIVE
        </span>
      ) : (
        <span
          className="text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0"
          style={{
            background: "var(--bg-overlay)",
            color: "var(--text-dim)",
            border: "1px solid var(--border)",
          }}
        >
          UPCOMING
        </span>
      )}

      <span className="text-[11px] font-medium text-[var(--text-primary)] truncate">
        {formatWindowTime(windowStartIso)}
      </span>

      <span
        className={`tabnum text-[10px] ml-auto shrink-0 ${
          isUrgent
            ? "text-red"
            : secondsRemaining < 3600
            ? "text-[var(--amber)]"
            : "text-[var(--text-secondary)]"
        }`}
      >
        {formatted}
      </span>

      <span className="text-[10px] text-[var(--text-dim)] shrink-0">
        {count}m
      </span>
    </div>
  );
}

function SidebarMarketRow({
  market,
  assetData,
  isSelected,
  onSelect,
}: {
  market: PolymarketMarket;
  assetData: AssetData | undefined;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const upToken = market.tokens.find((t) => t.outcome === "Yes");
  const livePrice = assetData?.price ?? 0;
  const marketPrice = upToken?.price ?? 0.5;
  const { secondsRemaining } = useCountdown(market.end_date_iso);

  const edge = useMemo(() => {
    if (!assetData || !livePrice || !secondsRemaining) return 0;
    const prob = calcProbability({
      currentPrice: livePrice,
      strikePrice: livePrice || 1,
      direction: "above",
      secondsRemaining,
      annualizedVolatility: assetData.vol ?? 0.8,
      recentDrift: assetData.drift30s ?? 0,
    });
    return prob.isValid ? calcEdge(prob.modelProbability, marketPrice) : 0;
  }, [livePrice, assetData, secondsRemaining, marketPrice]);

  return (
    <button
      onClick={onSelect}
      className="w-full flex items-center gap-2 px-3 py-2 border-b border-[var(--border)] text-left transition-colors hover:bg-[var(--bg-elevated)]"
      style={{
        minHeight: 40,
        background: isSelected ? "var(--accent-dim)" : "transparent",
        borderLeft: isSelected ? "2px solid var(--accent)" : "2px solid transparent",
      }}
    >
      {/* Icon */}
      <div
        className="flex items-center justify-center w-6 h-6 rounded-full shrink-0 text-[10px] font-bold"
        style={{
          background: isSelected ? "var(--accent)" : "var(--bg-overlay)",
          color: isSelected ? "#fff" : "var(--text-secondary)",
        }}
      >
        {ASSET_ICONS[market.asset ?? ""] ?? market.asset?.[0] ?? "?"}
      </div>

      {/* Name + price */}
      <div className="flex-1 min-w-0">
        <div
          className="text-[12px] font-medium truncate"
          style={{ color: isSelected ? "var(--accent)" : "var(--text-primary)" }}
        >
          {market.asset} Up/Down
        </div>
        {livePrice > 0 && (
          <div className="text-[10px] tabnum" style={{ color: "var(--text-secondary)" }}>
            {fmt(livePrice)}
          </div>
        )}
      </div>

      {/* Edge */}
      <div className="shrink-0">
        <EdgeBadge edge={edge} />
      </div>
    </button>
  );
}

export function MarketSidebar({ markets, prices, selectedId, onSelect }: Props) {
  const windows = useMemo(() => {
    const map = new Map<string, PolymarketMarket[]>();
    for (const m of markets) {
      const key = m.window_start_iso ?? m.end_date_iso;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    return Array.from(map.entries());
  }, [markets]);

  return (
    <div
      className="flex flex-col overflow-hidden border-r border-[var(--border)] shrink-0"
      style={{ width: 280, background: "var(--bg-surface)" }}
    >
      {/* Header */}
      <div
        className="flex items-center px-3 py-2.5 border-b border-[var(--border)] shrink-0"
        style={{ background: "var(--bg-elevated)" }}
      >
        <span className="text-[11px] font-medium uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
          Markets
        </span>
        <span
          className="ml-auto text-[10px] tabnum"
          style={{ color: "var(--text-dim)" }}
        >
          {markets.length}
        </span>
      </div>

      {/* Scrollable list */}
      <div className="overflow-y-auto flex-1">
        {windows.map(([key, windowMarkets], wi) => (
          <div key={key}>
            <WindowGroupHeader
              endDateIso={windowMarkets[0].end_date_iso}
              windowStartIso={windowMarkets[0].window_start_iso ?? ""}
              count={windowMarkets.length}
              isFirst={wi === 0}
            />
            {windowMarkets.map((market) => (
              <SidebarMarketRow
                key={market.id}
                market={market}
                assetData={market.asset ? prices[market.asset] : undefined}
                isSelected={market.id === selectedId}
                onSelect={() => onSelect(market)}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
