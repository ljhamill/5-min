"use client";

import { useOrderbook } from "@/hooks/useOrderbook";
import { useCountdown } from "@/hooks/useCountdown";
import { calcProbability } from "@/lib/probability/engine";
import { ProbabilityBar } from "@/components/probability/ProbabilityBar";
import { TradePanel } from "@/components/market/TradePanel";
import type { PolymarketMarket } from "@/lib/polymarket/types";
import type { AssetData } from "@/hooks/useBinancePrice";

type Props = {
  market: PolymarketMarket;
  assetData: AssetData | undefined;
};

export function MarketCard({ market, assetData }: Props) {
  const yesToken = market.tokens.find((t) => t.outcome === "Yes");
  const noToken = market.tokens.find((t) => t.outcome === "No");

  const book = useOrderbook(yesToken?.token_id);
  const { secondsRemaining, formatted, isExpired, isUrgent } = useCountdown(
    market.end_date_iso,
  );

  const marketPrice = book?.midPrice ?? yesToken?.price ?? 0.5;

  // "Up or Down" markets: strike = current live price (no fixed dollar level).
  // Model gives ~50% base, shifted by recent momentum drift.
  const livePrice = assetData?.price ?? 0;
  const probResult = calcProbability({
    currentPrice: livePrice,
    strikePrice: livePrice || 1,
    direction: market.direction ?? "above",
    secondsRemaining,
    annualizedVolatility: assetData?.vol ?? 0.8,
    recentDrift: assetData?.drift30s ?? 0,
  });

  const livePriceDisplay = assetData?.price
    ? `$${assetData.price.toLocaleString("en-US", { maximumFractionDigits: 2 })}`
    : "—";

  const priceChange =
    assetData && assetData.prevPrice
      ? ((assetData.price - assetData.prevPrice) / assetData.prevPrice) * 100
      : 0;

  return (
    <div
      className={`terminal-card p-4 flex flex-col gap-3 ${
        isExpired ? "opacity-40 pointer-events-none" : ""
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {market.asset && (
              <span className="text-[10px] px-1.5 py-0.5 border border-[var(--border-bright)] text-[var(--cyan)]">
                {market.asset}
              </span>
            )}
            <span className="text-[10px] text-[var(--text-secondary)]">UP / DOWN</span>
          </div>
          <p className="text-xs text-[var(--text-primary)] leading-snug line-clamp-2">
            {market.question}
          </p>
        </div>

        {/* Countdown */}
        <div className="shrink-0 text-right">
          <div
            className={`text-sm tabular-nums font-medium ${
              isUrgent
                ? "text-[var(--red)] blink"
                : "text-[var(--amber)]"
            }`}
          >
            {formatted}
          </div>
          <div className="text-[10px] text-[var(--text-dim)]">REMAINING</div>
        </div>
      </div>

      {/* Live price */}
      {assetData && (
        <div className="flex items-center gap-2 border-t border-[var(--border)] pt-2">
          <span className="text-[10px] text-[var(--text-secondary)]">LIVE</span>
          <span className="text-sm tabular-nums text-[var(--text-primary)]">
            {livePriceDisplay}
          </span>
          <span
            className={`text-[10px] tabular-nums ml-auto ${
              priceChange >= 0 ? "text-[var(--green)]" : "text-[var(--red)]"
            }`}
          >
            {priceChange >= 0 ? "▲" : "▼"}
            {Math.abs(priceChange).toFixed(3)}%
          </span>
        </div>
      )}

      {/* Probability bar */}
      <ProbabilityBar
        modelProb={probResult.modelProbability}
        marketPrice={marketPrice}
        isValid={probResult.isValid}
      />

      {/* Orderbook spread */}
      {book && (
        <div className="flex items-center gap-3 text-[10px]">
          <div>
            <span className="text-[var(--text-dim)]">BID </span>
            <span className="text-[var(--green)] tabular-nums">
              {(book.bestBid * 100).toFixed(1)}¢
            </span>
          </div>
          <div>
            <span className="text-[var(--text-dim)]">ASK </span>
            <span className="text-[var(--red)] tabular-nums">
              {(book.bestAsk * 100).toFixed(1)}¢
            </span>
          </div>
          <div>
            <span className="text-[var(--text-dim)]">SPRD </span>
            <span className="text-[var(--text-secondary)] tabular-nums">
              {(book.spread * 100).toFixed(1)}¢
            </span>
          </div>
        </div>
      )}

      {/* Trade panel */}
      <div className="border-t border-[var(--border)] pt-3">
        <TradePanel
          yesTokenId={yesToken?.token_id ?? ""}
          noTokenId={noToken?.token_id ?? ""}
          tickSize={market.tick_size}
          bestAsk={book?.bestAsk ?? 0.5}
          bestBid={book?.bestBid ?? 0.5}
        />
      </div>
    </div>
  );
}
