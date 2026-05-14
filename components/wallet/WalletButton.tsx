"use client";

import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { polygon } from "wagmi/chains";

export function WalletButton() {
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();

  const isWrongChain = isConnected && chainId !== polygon.id;

  if (isWrongChain) {
    return (
      <button
        onClick={() => switchChain({ chainId: polygon.id })}
        className="px-3 py-1.5 text-xs border border-[var(--amber)] text-[var(--amber)] hover:bg-[var(--amber-dim)] transition-colors"
      >
        SWITCH TO POLYGON
      </button>
    );
  }

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-xs text-[var(--text-secondary)]">
          <span className="text-green mr-1">●</span>
          {address.slice(0, 6)}...{address.slice(-4)}
        </span>
        <button
          onClick={() => disconnect()}
          className="px-3 py-1.5 text-xs border border-[var(--border-bright)] text-[var(--text-secondary)] hover:border-[var(--red)] hover:text-[var(--red)] transition-colors"
        >
          DISCONNECT
        </button>
      </div>
    );
  }

  const injected = connectors.find((c) => c.id === "injected");

  return (
    <button
      disabled={isPending}
      onClick={() => injected && connect({ connector: injected })}
      className="px-3 py-1.5 text-xs border border-[var(--amber)] text-[var(--amber)] hover:bg-[var(--amber-dim)] transition-colors disabled:opacity-50"
    >
      {isPending ? "CONNECTING..." : "CONNECT WALLET"}
    </button>
  );
}
