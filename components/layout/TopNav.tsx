"use client";

import Link from "next/link";
import { useAccount, useConnect, useDisconnect } from "wagmi";

export type MarketVertical = {
  id: string;
  label: string;
  href: string;
  soon?: boolean;
};

export const MARKET_VERTICALS: MarketVertical[] = [
  { id: "crypto", label: "Crypto",   href: "/"          },
  { id: "sports", label: "Sports",   href: "#", soon: true },
];

type Props = { activeVertical?: string };

export function TopNav({ activeVertical = "crypto" }: Props) {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  const injected = connectors.find((c) => c.id === "injected");

  return (
    <header
      className="flex items-center justify-between px-4 shrink-0 border-b border-[var(--border)]"
      style={{ height: "var(--nav-h)", background: "var(--bg-surface)" }}
    >
      {/* Left: logo + verticals */}
      <div className="flex items-center gap-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
            <path d="M10 2L18 10L10 18L2 10L10 2Z" fill="var(--accent)" />
            <path d="M10 5L15 10L10 15L5 10L10 5Z" fill="var(--bg-surface)" />
          </svg>
          <span className="text-[13px] font-semibold tracking-tight text-[var(--text-primary)]">
            5MIN
          </span>
        </Link>

        {/* Vertical nav */}
        <nav className="flex items-center gap-0.5">
          {MARKET_VERTICALS.map((v) => {
            const isActive = v.id === activeVertical;
            return (
              <Link
                key={v.id}
                href={v.href}
                className={`relative flex items-center gap-1.5 px-3 py-1.5 text-[13px] transition-colors select-none ${
                  isActive
                    ? "text-[var(--text-primary)] font-medium"
                    : v.soon
                    ? "text-[var(--text-dim)] cursor-not-allowed"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                {v.label}

                {/* "Soon" badge — same styling as axiom, dim chip */}
                {v.soon && (
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

                {/* Active underline */}
                {isActive && (
                  <span
                    className="absolute bottom-0 left-3 right-3 h-px"
                    style={{ background: "var(--accent)" }}
                  />
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Right: wallet */}
      <div className="flex items-center gap-2">
        {isConnected && address ? (
          <div className="flex items-center gap-2">
            <div
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border"
              style={{ borderColor: "var(--border)", background: "var(--bg-elevated)" }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full pulse-dot shrink-0"
                style={{ background: "var(--green)" }}
              />
              <span className="text-[12px] text-[var(--text-secondary)] tabnum">
                {address.slice(0, 6)}…{address.slice(-4)}
              </span>
            </div>
            <button
              onClick={() => disconnect()}
              className="px-2.5 py-1.5 rounded text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)] hover:border-[var(--border-bright)] transition-colors"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <button
            disabled={isPending}
            onClick={() => injected && connect({ connector: injected })}
            className="px-4 py-1.5 rounded-full text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ background: "var(--accent)" }}
          >
            {isPending ? "Connecting…" : "Connect Wallet"}
          </button>
        )}
      </div>
    </header>
  );
}
