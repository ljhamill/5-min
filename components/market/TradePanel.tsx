"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { useTrade } from "@/hooks/useTrade";
import type { OrderSide } from "@/lib/polymarket/types";

type Props = {
  yesTokenId: string;
  noTokenId: string;
  tickSize: string;
  bestAsk: number;
  bestBid: number;
};

const PRESET_AMOUNTS = [10, 25, 50, 100];

export function TradePanel({ yesTokenId, noTokenId, tickSize, bestAsk, bestBid }: Props) {
  const { isConnected } = useAccount();
  const { state, executeTrade } = useTrade();
  const [amount, setAmount] = useState(25);

  const isPending = state.status === "signing" || state.status === "pending";

  function handleTrade(side: OrderSide) {
    const tokenId = side === "YES" ? yesTokenId : noTokenId;
    executeTrade({ tokenId, amountUsdc: amount, side, tickSize });
  }

  if (!isConnected) {
    return (
      <div className="text-[10px] text-[var(--text-secondary)] text-center py-2">
        Connect wallet to trade
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Amount row */}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-[var(--text-secondary)] w-10 shrink-0">SIZE</span>
        <div className="flex gap-1">
          {PRESET_AMOUNTS.map((a) => (
            <button
              key={a}
              onClick={() => setAmount(a)}
              className={`px-2 py-0.5 text-[10px] border transition-colors ${
                amount === a
                  ? "border-[var(--amber)] text-[var(--amber)] bg-[var(--amber-dim)]"
                  : "border-[var(--border-bright)] text-[var(--text-secondary)] hover:border-[var(--border-bright)]"
              }`}
            >
              ${a}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 ml-1">
          <span className="text-[10px] text-[var(--text-dim)]">$</span>
          <input
            type="number"
            value={amount}
            min={1}
            onChange={(e) => setAmount(Math.max(1, Number(e.target.value)))}
            className="w-14 bg-[var(--bg-base)] border border-[var(--border-bright)] text-[var(--text-primary)] text-[10px] px-1.5 py-0.5 outline-none focus:border-[var(--amber)]"
          />
        </div>
      </div>

      {/* Trade buttons */}
      <div className="flex gap-2">
        <button
          disabled={isPending}
          onClick={() => handleTrade("YES")}
          className="flex-1 py-2 text-xs font-medium border border-[var(--green)] text-[var(--green)] bg-[var(--green-dim)] hover:bg-[var(--green)] hover:text-black transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isPending && state.status === "signing" ? "SIGNING..." : `BUY YES @ ${(bestAsk * 100).toFixed(0)}¢`}
        </button>
        <button
          disabled={isPending}
          onClick={() => handleTrade("NO")}
          className="flex-1 py-2 text-xs font-medium border border-[var(--red)] text-[var(--red)] bg-[var(--red-dim)] hover:bg-[var(--red)] hover:text-black transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isPending ? "..." : `BUY NO @ ${((1 - bestBid) * 100).toFixed(0)}¢`}
        </button>
      </div>

      {/* Status */}
      {state.status === "success" && (
        <div className="text-[10px] text-[var(--green)] text-center">
          ✓ Order submitted
        </div>
      )}
      {state.status === "error" && (
        <div className="text-[10px] text-[var(--red)] text-center truncate">
          {state.message}
        </div>
      )}
    </div>
  );
}
