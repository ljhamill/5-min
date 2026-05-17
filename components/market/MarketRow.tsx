"use client";

import { useState } from "react";
import { useOrderbook } from "@/hooks/useOrderbook";
import { useCountdown } from "@/hooks/useCountdown";
import { calcProbability } from "@/lib/probability/engine";
import { useTrade } from "@/hooks/useTrade";
import { useAccount } from "wagmi";
import type { PolymarketMarket } from "@/lib/polymarket/types";
import type { AssetData } from "@/hooks/useBinancePrice";

type Props = {
  market: PolymarketMarket;
  assetData: AssetData | undefined;
  gridTemplate: string;
  isEven: boolean;
};

const ASSET_ICONS: Record<string, string> = {
  BTC: "₿", ETH: "Ξ", SOL: "◎", XRP: "✕",
  BNB: "B", DOGE: "Ð", HYPE: "H", ADA: "₳",
};

function fmt(price: number): string {
  if (price >= 10000) return `$${price.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (price >= 1)     return `$${price.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  return `$${price.toFixed(4)}`;
}

function EdgeBadge({ edge }: { edge: number }) {
  const pct = (edge * 100).toFixed(1);
  const isPos = edge > 0.02;
  const isNeg = edge < -0.02;
  if (!isPos && !isNeg) {
    return <span className="text-[var(--text-dim)] tabnum">—</span>;
  }
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium tabnum"
      style={{
        background: isPos ? "var(--green-dim)" : "var(--red-dim)",
        color: isPos ? "var(--green)" : "var(--red)",
      }}
    >
      {edge > 0 ? "+" : ""}{pct}%
    </span>
  );
}

function OddsBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="h-1 rounded-full overflow-hidden"
        style={{ width: 48, background: "var(--border)" }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${value * 100}%`, background: color }}
        />
      </div>
      <span className="tabnum text-[12px]">{(value * 100).toFixed(0)}%</span>
    </div>
  );
}

export function MarketRow({ market, assetData, gridTemplate, isEven }: Props) {
  const upToken   = market.tokens.find((t) => t.outcome === "Yes");
  const downToken = market.tokens.find((t) => t.outcome === "No");
  const book = useOrderbook(upToken?.token_id);
  const { secondsRemaining, formatted, isUrgent } = useCountdown(market.end_date_iso);
  const { state, executeTrade } = useTrade();
  const { isConnected } = useAccount();
  const [tradeAmount, setTradeAmount] = useState(25);

  const livePrice = assetData?.price ?? 0;
  const marketPrice = book?.midPrice ?? upToken?.price ?? 0.5;

  const probResult = calcProbability({
    currentPrice: livePrice,
    strikePrice:  livePrice || 1,
    direction:    "above",
    secondsRemaining,
    annualizedVolatility: assetData?.vol ?? 0.8,
    recentDrift:  assetData?.drift30s ?? 0,
  });

  const edge = probResult.isValid ? probResult.modelProbability - marketPrice : 0;
  const isPending = state.status === "signing" || state.status === "pending";
  const annVolPct = assetData ? `${(assetData.vol * 100).toFixed(0)}%` : "—";

  function handleTrade(side: "YES" | "NO") {
    const tokenId = side === "YES" ? upToken?.token_id ?? "" : downToken?.token_id ?? "";
    executeTrade({ tokenId, amountUsdc: tradeAmount, side, tickSize: market.tick_size });
  }

  const priceChange = assetData?.prevPrice
    ? ((livePrice - assetData.prevPrice) / assetData.prevPrice) * 100
    : 0;

  const rowBg = isEven ? "var(--bg-base)" : "var(--bg-surface)";

  return (
    <div
      className="group grid items-center px-4 border-b border-[var(--border)] hover:bg-[var(--bg-elevated)] transition-colors"
      style={{ gridTemplateColumns: gridTemplate, minHeight: 48, background: rowBg }}
    >
      {/* Market label */}
      <div className="flex items-center gap-2 min-w-0">
        <div
          className="flex items-center justify-center w-7 h-7 rounded-full shrink-0 text-[11px] font-bold"
          style={{ background: "var(--bg-overlay)", color: "var(--text-secondary)" }}
        >
          {ASSET_ICONS[market.asset ?? ""] ?? market.asset?.[0] ?? "?"}
        </div>
        <div className="min-w-0">
          <div className="font-medium text-[13px] text-[var(--text-primary)] truncate">
            {market.asset} Up / Down
          </div>
          <div className="text-[11px] text-[var(--text-secondary)] truncate">
            Polymarket · Chainlink oracle
          </div>
        </div>
      </div>

      {/* Window countdown */}
      <div>
        <div
          className={`tabnum text-[12px] font-medium ${
            isUrgent ? "text-red" : secondsRemaining < 3600 ? "text-[var(--amber)]" : "text-[var(--text-secondary)]"
          }`}
        >
          {formatted}
        </div>
        <div className="text-[10px] text-[var(--text-dim)]">remaining</div>
      </div>

      {/* Live price */}
      <div>
        {livePrice ? (
          <>
            <div className="tabnum text-[12px] text-[var(--text-primary)]">{fmt(livePrice)}</div>
            <div
              className={`text-[10px] tabnum ${priceChange >= 0 ? "text-green" : "text-red"}`}
            >
              {priceChange >= 0 ? "▲" : "▼"}{Math.abs(priceChange).toFixed(3)}%
            </div>
          </>
        ) : (
          <span className="text-[var(--text-dim)]">—</span>
        )}
      </div>

      {/* Market odds (Polymarket implied) */}
      <OddsBar value={marketPrice} color="var(--text-secondary)" />

      {/* Model probability */}
      {probResult.isValid ? (
        <OddsBar
          value={probResult.modelProbability}
          color={edge > 0.02 ? "var(--green)" : edge < -0.02 ? "var(--red)" : "var(--accent)"}
        />
      ) : (
        <span className="text-[var(--text-dim)]">—</span>
      )}

      {/* Edge */}
      <EdgeBadge edge={edge} />

      {/* Annualized vol */}
      <span className="tabnum text-[12px] text-[var(--text-secondary)]">{annVolPct}</span>

      {/* Actions */}
      <div className="flex items-center gap-1.5">
        {/* Size input */}
        <div className="flex items-center gap-1 text-[11px] text-[var(--text-secondary)]">
          <span>$</span>
          <input
            type="number"
            value={tradeAmount}
            min={1}
            onChange={(e) => setTradeAmount(Math.max(1, Number(e.target.value)))}
            onClick={(e) => e.stopPropagation()}
            className="w-12 bg-[var(--bg-overlay)] border border-[var(--border)] text-[var(--text-primary)] text-[11px] px-1.5 py-1 rounded outline-none focus:border-[var(--accent)]"
          />
        </div>

        {/* Up button */}
        <button
          disabled={!isConnected || isPending}
          onClick={(e) => { e.stopPropagation(); handleTrade("YES"); }}
          className="flex items-center gap-1 px-3 py-1.5 rounded text-[12px] font-medium transition-all disabled:opacity-40"
          style={{
            background: "var(--green-dim)",
            color: "var(--green)",
            border: "1px solid rgba(34,197,94,0.2)",
          }}
        >
          ▲ Up
          {book && <span className="text-[10px] opacity-70">{(book.bestAsk * 100).toFixed(0)}¢</span>}
        </button>

        {/* Down button */}
        <button
          disabled={!isConnected || isPending}
          onClick={(e) => { e.stopPropagation(); handleTrade("NO"); }}
          className="flex items-center gap-1 px-3 py-1.5 rounded text-[12px] font-medium transition-all disabled:opacity-40"
          style={{
            background: "var(--red-dim)",
            color: "var(--red)",
            border: "1px solid rgba(239,68,68,0.2)",
          }}
        >
          ▼ Down
          {book && <span className="text-[10px] opacity-70">{((1 - book.bestBid) * 100).toFixed(0)}¢</span>}
        </button>
      </div>
    </div>
  );
}
