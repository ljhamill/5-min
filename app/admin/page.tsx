"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { WalletButton } from "@/components/wallet/WalletButton";

const ADMIN_ADDRESS = process.env.NEXT_PUBLIC_ADMIN_WALLET_ADDRESS?.toLowerCase();

export default function AdminPage() {
  const { address, isConnected } = useAccount();
  const [currentFee, setCurrentFee] = useState<number | null>(null);
  const [inputBps, setInputBps] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const isAdmin =
    isConnected && address && address.toLowerCase() === ADMIN_ADDRESS;

  useEffect(() => {
    fetch("/api/fee-config")
      .then((r) => r.json())
      .then((d) => {
        if (typeof d.fee_bps === "number") {
          setCurrentFee(d.fee_bps);
          setInputBps(String(d.fee_bps));
        }
      })
      .catch(() => {});
  }, []);

  async function handleSave() {
    if (!address) return;
    const bps = parseInt(inputBps, 10);
    if (isNaN(bps) || bps < 0 || bps > 10000) {
      setErrorMsg("Must be 0–10000 bps");
      setStatus("error");
      return;
    }

    setStatus("saving");
    try {
      const res = await fetch("/api/fee-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fee_bps: bps, wallet_address: address }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Failed");
      }
      setCurrentFee(bps);
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error");
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg-base)] p-6">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-[var(--border)]">
          <div>
            <div className="text-[10px] text-[var(--text-secondary)] mb-1">5MIN TERMINAL</div>
            <h1 className="text-sm text-[var(--amber)]">ADMIN PANEL</h1>
          </div>
          <WalletButton />
        </div>

        {!isConnected && (
          <div className="terminal-card p-6 text-center text-xs text-[var(--text-secondary)]">
            Connect your admin wallet to access settings.
          </div>
        )}

        {isConnected && !isAdmin && (
          <div className="terminal-card p-6 text-center text-xs text-[var(--red)]">
            UNAUTHORIZED — This wallet is not the admin address.
          </div>
        )}

        {isAdmin && (
          <div className="terminal-card p-6 space-y-6">
            <div>
              <h2 className="text-[10px] text-[var(--text-secondary)] mb-3 tracking-widest">
                FEE CONFIGURATION
              </h2>

              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--text-secondary)]">Current fee</span>
                  <span className="tabular-nums text-[var(--amber)]">
                    {currentFee !== null
                      ? `${currentFee} bps (${(currentFee / 100).toFixed(2)}%)`
                      : "Loading..."}
                  </span>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] text-[var(--text-secondary)]">
                    NEW FEE (BASIS POINTS, 0–10000)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={inputBps}
                      min={0}
                      max={10000}
                      onChange={(e) => setInputBps(e.target.value)}
                      className="flex-1 bg-[var(--bg-base)] border border-[var(--border-bright)] text-[var(--text-primary)] text-xs px-3 py-2 outline-none focus:border-[var(--amber)]"
                      placeholder="e.g. 50 = 0.50%"
                    />
                    <button
                      onClick={handleSave}
                      disabled={status === "saving"}
                      className="px-4 py-2 text-xs border border-[var(--amber)] text-[var(--amber)] hover:bg-[var(--amber-dim)] transition-colors disabled:opacity-50"
                    >
                      {status === "saving" ? "SAVING..." : "SAVE"}
                    </button>
                  </div>
                  <div className="text-[10px] text-[var(--text-dim)]">
                    0 = disabled · 100 = 1% · 10000 = 100% (Polymarket max enforced server-side)
                  </div>
                </div>

                {status === "saved" && (
                  <div className="text-[10px] text-[var(--green)]">✓ Fee updated</div>
                )}
                {status === "error" && (
                  <div className="text-[10px] text-[var(--red)]">{errorMsg}</div>
                )}
              </div>
            </div>

            <div className="border-t border-[var(--border)] pt-4">
              <h2 className="text-[10px] text-[var(--text-secondary)] mb-3 tracking-widest">
                BUILDER INFO
              </h2>
              <div className="space-y-2 text-[10px]">
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">Builder code</span>
                  <span className="text-[var(--text-primary)]">
                    {process.env.NEXT_PUBLIC_BUILDER_CODE_PREVIEW ?? "Set in env vars"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">Network</span>
                  <span className="text-[var(--cyan)]">Polygon Mainnet</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
