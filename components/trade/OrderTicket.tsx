"use client";

import { useState, useMemo } from "react";
import { useAccount } from "wagmi";
import { useTrade } from "@/hooks/useTrade";
import { useOrderbook } from "@/hooks/useOrderbook";
import { useCountdown } from "@/hooks/useCountdown";
import { calcProbability, calcEdge } from "@/lib/probability/engine";
import type { PolymarketMarket } from "@/lib/polymarket/types";
import type { AssetData } from "@/hooks/useBinancePrice";

type Props = {
  market: PolymarketMarket | null;
  assetData: AssetData | undefined;
};

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
  if (!isPos && !isNeg) return null;
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium tabnum"
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

export function OrderTicket({ market, assetData }: Props) {
  const { isConnected } = useAccount();
  const { state, executeTrade } = useTrade();
  const [amount, setAmount] = useState(25);

  const upToken = market?.tokens.find((t) => t.outcome === "Yes");
  const downToken = market?.tokens.find((t) => t.outcome === "No");

  const book = useOrderbook(upToken?.token_id);
  const { secondsRemaining } = useCountdown(market?.end_date_iso ?? new Date(0).toISOString());

  const livePrice = assetData?.price ?? 0;
  const marketMidPrice = book?.midPrice ?? upToken?.price ?? 0.5;

  const probResult = useMemo(() => {
    if (!livePrice || !secondsRemaining || !assetData) return null;
    return calcProbability({
      currentPrice: livePrice,
      strikePrice: livePrice || 1,
      direction: "above",
      secondsRemaining,
      annualizedVolatility: assetData.vol ?? 0.8,
      recentDrift: assetData.drift30s ?? 0,
    });
  }, [livePrice, secondsRemaining, assetData]);

  const edge = probResult?.isValid
    ? calcEdge(probResult.modelProbability, marketMidPrice)
    : 0;

  const isPending =
    state.status === "signing" || state.status === "pending";

  function handleTrade(side: "YES" | "NO") {
    if (!market) return;
    const tokenId =
      side === "YES"
        ? upToken?.token_id ?? ""
        : downToken?.token_id ?? "";
    executeTrade({
      tokenId,
      amountUsdc: amount,
      side,
      tickSize: market.tick_size,
    });
  }

  // Empty state
  if (!market) {
    return (
      <div
        className="flex flex-col items-center justify-center shrink-0 border-l border-[var(--border)]"
        style={{ width: 280, background: "var(--bg-surface)", color: "var(--text-dim)", fontSize: 12, textAlign: "center", padding: 24 }}
      >
        <div style={{ fontSize: 24, marginBottom: 8 }}>↑↓</div>
        Select a market to begin trading
      </div>
    );
  }

  return (
    <div
      className="flex flex-col shrink-0 border-l border-[var(--border)] overflow-y-auto"
      style={{ width: 280, background: "var(--bg-surface)" }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 border-b border-[var(--border)] shrink-0"
        style={{ background: "var(--bg-elevated)" }}
      >
        <div className="text-[11px] font-medium uppercase tracking-wide mb-0.5" style={{ color: "var(--text-secondary)" }}>
          Order Ticket
        </div>
        <div className="font-semibold text-[14px]" style={{ color: "var(--text-primary)" }}>
          {market.asset} Up / Down
        </div>
      </div>

      <div className="flex flex-col gap-4 p-4">
        {/* Live price */}
        <div>
          <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: "var(--text-dim)" }}>
            Live Price
          </div>
          <div className="tabnum text-[22px] font-semibold" style={{ color: "var(--text-primary)" }}>
            {livePrice > 0 ? fmt(livePrice) : "—"}
          </div>
        </div>

        {/* Market odds + model */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: "var(--text-dim)" }}>
              Market
            </div>
            <div className="tabnum text-[16px] font-medium" style={{ color: "var(--text-primary)" }}>
              {(marketMidPrice * 100).toFixed(1)}%
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: "var(--text-dim)" }}>
              Model
            </div>
            <div
              className="tabnum text-[16px] font-medium"
              style={{
                color: probResult?.isValid
                  ? edge > 0.02
                    ? "var(--green)"
                    : edge < -0.02
                    ? "var(--red)"
                    : "var(--text-primary)"
                  : "var(--text-dim)",
              }}
            >
              {probResult?.isValid
                ? `${(probResult.modelProbability * 100).toFixed(1)}%`
                : "—"}
            </div>
          </div>
        </div>

        {/* Edge */}
        {probResult?.isValid && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
              Edge
            </span>
            <EdgeBadge edge={edge} />
          </div>
        )}

        {/* Divider */}
        <div style={{ borderTop: "1px solid var(--border)" }} />

        {/* Amount input */}
        <div>
          <div className="text-[10px] uppercase tracking-wide mb-1.5" style={{ color: "var(--text-dim)" }}>
            Size (USDC)
          </div>
          <div
            className="flex items-center gap-1.5 px-3 py-2 rounded"
            style={{
              background: "var(--bg-overlay)",
              border: "1px solid var(--border)",
            }}
          >
            <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>$</span>
            <input
              type="number"
              value={amount}
              min={1}
              onChange={(e) => setAmount(Math.max(1, Number(e.target.value)))}
              className="flex-1 bg-transparent outline-none tabnum text-[13px]"
              style={{ color: "var(--text-primary)", border: "none" }}
            />
          </div>
          {/* Quick-pick buttons */}
          <div className="flex gap-1.5 mt-2">
            {[10, 25, 50, 100].map((v) => (
              <button
                key={v}
                onClick={() => setAmount(v)}
                className="flex-1 py-1 rounded text-[10px] font-medium transition-colors"
                style={{
                  background: amount === v ? "var(--accent-dim)" : "var(--bg-overlay)",
                  color: amount === v ? "var(--accent)" : "var(--text-secondary)",
                  border: `1px solid ${amount === v ? "var(--accent)" : "var(--border)"}`,
                }}
              >
                ${v}
              </button>
            ))}
          </div>
        </div>

        {/* Trade buttons */}
        {!isConnected ? (
          <div
            className="flex items-center justify-center py-3 rounded text-[12px]"
            style={{
              background: "var(--bg-overlay)",
              color: "var(--text-secondary)",
              border: "1px solid var(--border)",
            }}
          >
            Connect wallet to trade
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {/* Up (YES) */}
            <button
              disabled={isPending}
              onClick={() => handleTrade("YES")}
              className="flex items-center justify-between px-4 py-3 rounded font-medium text-[13px] transition-all disabled:opacity-40"
              style={{
                background: "var(--green-dim)",
                color: "var(--green)",
                border: "1px solid rgba(34,197,94,0.25)",
              }}
            >
              <span className="flex items-center gap-1.5">
                <span>▲</span>
                <span>Up (YES)</span>
              </span>
              {book && (
                <span className="text-[11px] opacity-70 tabnum">
                  {(book.bestAsk * 100).toFixed(0)}¢
                </span>
              )}
            </button>

            {/* Down (NO) */}
            <button
              disabled={isPending}
              onClick={() => handleTrade("NO")}
              className="flex items-center justify-between px-4 py-3 rounded font-medium text-[13px] transition-all disabled:opacity-40"
              style={{
                background: "var(--red-dim)",
                color: "var(--red)",
                border: "1px solid rgba(239,68,68,0.25)",
              }}
            >
              <span className="flex items-center gap-1.5">
                <span>▼</span>
                <span>Down (NO)</span>
              </span>
              {book && (
                <span className="text-[11px] opacity-70 tabnum">
                  {((1 - book.bestBid) * 100).toFixed(0)}¢
                </span>
              )}
            </button>
          </div>
        )}

        {/* Trade status */}
        {state.status !== "idle" && (
          <div
            className="flex items-center gap-2 px-3 py-2 rounded text-[11px]"
            style={{
              background:
                state.status === "success"
                  ? "var(--green-dim)"
                  : state.status === "error"
                  ? "var(--red-dim)"
                  : "var(--accent-dim)",
              color:
                state.status === "success"
                  ? "var(--green)"
                  : state.status === "error"
                  ? "var(--red)"
                  : "var(--accent)",
            }}
          >
            {state.status === "signing" && (
              <>
                <span className="pulse-dot w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "var(--accent)" }} />
                Signing…
              </>
            )}
            {state.status === "pending" && (
              <>
                <span className="pulse-dot w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "var(--accent)" }} />
                Submitting…
              </>
            )}
            {state.status === "success" && <>Order placed</>}
            {state.status === "error" && <>{state.message}</>}
          </div>
        )}
      </div>
    </div>
  );
}
