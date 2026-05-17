"use client";

type TimeWindow = {
  id: string;
  label: string;
  soon?: boolean;
};

const TIME_WINDOWS: TimeWindow[] = [
  { id: "5m",    label: "5 Min"  },
  { id: "15m",   label: "15 Min",  soon: true },
  { id: "30m",   label: "30 Min",  soon: true },
  { id: "1h",    label: "1 Hr",    soon: true },
  { id: "4h",    label: "4 Hr",    soon: true },
  { id: "daily", label: "Daily",   soon: true },
];

const ASSETS = ["All", "BTC", "ETH", "SOL", "XRP", "BNB", "DOGE", "HYPE"];

type Props = {
  activeAsset: string;
  onAssetChange: (asset: string) => void;
  activeWindow?: string;
  marketCount: number;
};

export function SubNav({
  activeAsset,
  onAssetChange,
  activeWindow = "5m",
  marketCount,
}: Props) {
  return (
    <div
      className="flex items-center gap-4 px-4 shrink-0 border-b border-[var(--border)]"
      style={{ height: "var(--subnav-h)", background: "var(--bg-base)" }}
    >
      {/* Time window tabs */}
      <div className="flex items-center gap-0.5">
        {TIME_WINDOWS.map((w) => {
          const isActive = w.id === activeWindow;
          return (
            <button
              key={w.id}
              disabled={w.soon}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[12px] font-medium transition-colors ${
                isActive
                  ? "text-[var(--accent)] bg-[var(--accent-dim)]"
                  : w.soon
                  ? "text-[var(--text-dim)] cursor-not-allowed"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
              }`}
            >
              {w.label}
              {w.soon && (
                <span
                  className="text-[9px] font-medium px-1 py-0.5 rounded leading-none"
                  style={{
                    background: "var(--bg-overlay)",
                    color: "var(--text-dim)",
                    border: "1px solid var(--border)",
                  }}
                >
                  SOON
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Divider */}
      <div className="w-px h-4 shrink-0" style={{ background: "var(--border)" }} />

      {/* Asset filter chips */}
      <div className="flex items-center gap-0.5">
        {ASSETS.map((asset) => {
          const isActive = asset === activeAsset;
          return (
            <button
              key={asset}
              onClick={() => onAssetChange(asset)}
              className={`px-2.5 py-1 rounded text-[12px] font-medium transition-colors ${
                isActive
                  ? "text-[var(--text-primary)] bg-[var(--bg-elevated)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
              }`}
            >
              {asset}
            </button>
          );
        })}
      </div>

      {/* Right: live indicator + count */}
      <div className="flex items-center gap-3 ml-auto">
        <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)]">
          <span
            className="w-1.5 h-1.5 rounded-full pulse-dot shrink-0"
            style={{ background: "var(--green)" }}
          />
          LIVE
        </div>
        <span className="text-[11px] text-[var(--text-dim)]">
          {marketCount} market{marketCount !== 1 ? "s" : ""}
        </span>
      </div>
    </div>
  );
}
