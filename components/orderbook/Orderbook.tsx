"use client";

import { useOrderbook } from "@/hooks/useOrderbook";

type Props = {
  tokenId: string | undefined;
};

const MAX_LEVELS = 8;

function formatPrice(price: string): string {
  const n = parseFloat(price);
  return `${(n * 100).toFixed(0)}¢`;
}

function formatSize(size: string): string {
  const n = parseFloat(size);
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toFixed(0);
}

function LevelRow({
  price,
  size,
  side,
  maxSize,
}: {
  price: string;
  size: string;
  side: "bid" | "ask";
  maxSize: number;
}) {
  const sizeNum = parseFloat(size);
  const pct = maxSize > 0 ? (sizeNum / maxSize) * 100 : 0;
  const color = side === "bid" ? "var(--green)" : "var(--red)";
  const bgColor = side === "bid" ? "var(--green-dim)" : "var(--red-dim)";

  return (
    <div className="relative flex items-center px-3 py-0.5" style={{ height: 24 }}>
      {/* Depth bar */}
      <div
        className="absolute inset-y-0 pointer-events-none"
        style={{
          [side === "bid" ? "right" : "left"]: 0,
          width: `${pct}%`,
          background: bgColor,
          opacity: 0.5,
        }}
      />
      <span
        className="tabnum text-[11px] z-10 flex-1"
        style={{ color }}
      >
        {formatPrice(price)}
      </span>
      <span className="tabnum text-[11px] z-10" style={{ color: "var(--text-secondary)" }}>
        {formatSize(size)}
      </span>
    </div>
  );
}

export function Orderbook({ tokenId }: Props) {
  const book = useOrderbook(tokenId);

  if (!tokenId) {
    return (
      <div
        className="flex items-center justify-center"
        style={{
          height: 200,
          background: "var(--bg-surface)",
          borderTop: "1px solid var(--border)",
          color: "var(--text-dim)",
          fontSize: 12,
        }}
      >
        No orderbook
      </div>
    );
  }

  if (!book) {
    return (
      <div
        className="flex items-center justify-center gap-2"
        style={{
          height: 200,
          background: "var(--bg-surface)",
          borderTop: "1px solid var(--border)",
          color: "var(--text-secondary)",
          fontSize: 12,
        }}
      >
        <span
          className="pulse-dot w-1.5 h-1.5 rounded-full inline-block shrink-0"
          style={{ background: "var(--accent)" }}
        />
        Loading…
      </div>
    );
  }

  const displayBids = book.bids.slice(0, MAX_LEVELS);
  const displayAsks = book.asks.slice(0, MAX_LEVELS);

  const maxBidSize = Math.max(...displayBids.map((b) => parseFloat(b.size)), 1);
  const maxAskSize = Math.max(...displayAsks.map((a) => parseFloat(a.size)), 1);
  const spreadPct = book.spread > 0 ? (book.spread * 100).toFixed(1) : null;

  return (
    <div
      className="flex flex-col shrink-0"
      style={{
        height: 200,
        background: "var(--bg-surface)",
        borderTop: "1px solid var(--border)",
        overflow: "hidden",
      }}
    >
      {/* Column headers */}
      <div
        className="flex items-center px-3 py-1.5 border-b border-[var(--border)] shrink-0"
        style={{ background: "var(--bg-elevated)" }}
      >
        <span className="text-[10px] font-medium uppercase tracking-wide flex-1" style={{ color: "var(--green)" }}>
          Bids
        </span>
        <span className="text-[10px] font-medium uppercase tracking-wide" style={{ color: "var(--red)" }}>
          Asks
        </span>
      </div>

      {/* Two columns */}
      <div className="flex flex-1 overflow-hidden">
        {/* Bids */}
        <div className="flex-1 flex flex-col overflow-hidden border-r border-[var(--border)]">
          {displayBids.map((level, i) => (
            <LevelRow
              key={`bid-${i}`}
              price={level.price}
              size={level.size}
              side="bid"
              maxSize={maxBidSize}
            />
          ))}
        </div>

        {/* Asks */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {displayAsks.map((level, i) => (
            <LevelRow
              key={`ask-${i}`}
              price={level.price}
              size={level.size}
              side="ask"
              maxSize={maxAskSize}
            />
          ))}
        </div>
      </div>

      {/* Spread footer */}
      <div
        className="flex items-center justify-center px-3 py-1 border-t border-[var(--border)] shrink-0"
        style={{ background: "var(--bg-elevated)" }}
      >
        <span className="text-[10px]" style={{ color: "var(--text-dim)" }}>
          Mid{" "}
          <span className="tabnum" style={{ color: "var(--text-secondary)" }}>
            {(book.midPrice * 100).toFixed(1)}¢
          </span>
          {spreadPct && (
            <>
              {" · "}Spread{" "}
              <span className="tabnum" style={{ color: "var(--text-secondary)" }}>
                {spreadPct}¢
              </span>
            </>
          )}
        </span>
      </div>
    </div>
  );
}
