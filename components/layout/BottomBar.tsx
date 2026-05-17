"use client";

import type { AssetData } from "@/hooks/useBinancePrice";
import { useAccount } from "wagmi";

type Props = {
  prices: Record<string, AssetData>;
};

const PINNED: { asset: string; pair: string }[] = [
  { asset: "BTC", pair: "BTC/USD" },
  { asset: "ETH", pair: "ETH/USD" },
  { asset: "SOL", pair: "SOL/USD" },
];

function fmt(price: number): string {
  if (price >= 1000) return `$${(price / 1000).toFixed(1)}K`;
  if (price >= 1)    return `$${price.toFixed(2)}`;
  return `$${price.toFixed(4)}`;
}

export function BottomBar({ prices }: Props) {
  const { address, isConnected } = useAccount();

  return (
    <div
      className="flex items-center justify-between px-4 shrink-0 border-t border-[var(--border)] text-[11px]"
      style={{ height: "var(--bar-h)", background: "var(--bg-surface)" }}
    >
      {/* Left: live price tickers */}
      <div className="flex items-center gap-4">
        {PINNED.map(({ asset, pair }) => {
          const d = prices[asset];
          if (!d) return (
            <span key={asset} className="text-[var(--text-dim)]">{pair} —</span>
          );
          const up = d.price >= d.prevPrice;
          return (
            <div key={asset} className="flex items-center gap-1">
              <span className="text-[var(--text-secondary)] font-medium">{pair}</span>
              <span className="tabnum text-[var(--text-primary)]">{fmt(d.price)}</span>
              <span className={up ? "text-green" : "text-red"}>
                {up ? "▲" : "▼"}
              </span>
            </div>
          );
        })}
      </div>

      {/* Right: wallet status */}
      <div className="flex items-center gap-3">
        {isConnected && address ? (
          <span className="text-[var(--text-secondary)]">
            {address.slice(0, 6)}…{address.slice(-4)}
          </span>
        ) : (
          <div className="flex items-center gap-1.5">
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: "var(--red)" }}
            />
            <span className="text-[var(--text-secondary)]">Disconnected</span>
          </div>
        )}
        <span className="text-[var(--text-dim)]">POLYGON</span>
      </div>
    </div>
  );
}
