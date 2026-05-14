"use client";

import Link from "next/link";
import { WalletButton } from "@/components/wallet/WalletButton";

type AssetTicker = {
  asset: string;
  price: number;
  prevPrice: number;
};

type Props = {
  tickers: AssetTicker[];
};

export function Header({ tickers }: Props) {
  return (
    <header className="border-b border-[var(--border)] bg-[var(--bg-card)]">
      {/* Top bar: logo + wallet */}
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-xs font-medium text-[var(--amber)] tracking-widest">
            5MIN
          </Link>
          <span className="text-[var(--text-dim)]">|</span>
          <span className="text-[10px] text-[var(--text-secondary)]">
            CRYPTO TERMINAL
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[10px] text-[var(--text-secondary)] hidden sm:block">
            <span className="blink text-[var(--green)] mr-1">●</span>
            LIVE
          </span>
          <WalletButton />
        </div>
      </div>

      {/* Ticker strip */}
      {tickers.length > 0 && (
        <div className="border-t border-[var(--border)] px-4 py-1.5 flex items-center gap-4 overflow-x-auto scrollbar-none">
          {tickers.map(({ asset, price, prevPrice }) => {
            const change = prevPrice
              ? ((price - prevPrice) / prevPrice) * 100
              : 0;
            const isUp = change >= 0;
            return (
              <div key={asset} className="flex items-center gap-1.5 shrink-0">
                <span className="text-[10px] text-[var(--text-secondary)]">{asset}</span>
                <span className="text-[10px] tabular-nums text-[var(--text-primary)]">
                  ${price.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                </span>
                <span
                  className={`text-[10px] tabular-nums ${
                    isUp ? "text-[var(--green)]" : "text-[var(--red)]"
                  }`}
                >
                  {isUp ? "▲" : "▼"}{Math.abs(change).toFixed(2)}%
                </span>
              </div>
            );
          })}
        </div>
      )}
    </header>
  );
}
