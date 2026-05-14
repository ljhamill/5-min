"use client";

import { useState } from "react";
import { useWalletClient } from "wagmi";
import { polygon } from "wagmi/chains";
import type { OrderSide } from "@/lib/polymarket/types";

type TradeState =
  | { status: "idle" }
  | { status: "signing" }
  | { status: "pending" }
  | { status: "success"; orderId: string }
  | { status: "error"; message: string };

export function useTrade() {
  const { data: walletClient } = useWalletClient({ chainId: polygon.id });
  const [state, setState] = useState<TradeState>({ status: "idle" });

  async function executeTrade({
    tokenId,
    amountUsdc,
    side,
    tickSize,
  }: {
    tokenId: string;
    amountUsdc: number;
    side: OrderSide;
    tickSize: string;
  }) {
    if (!walletClient) {
      setState({ status: "error", message: "Wallet not connected" });
      return;
    }

    try {
      setState({ status: "signing" });

      const res = await fetch("/api/trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tokenId,
          amountUsdc,
          side,
          tickSize,
          walletAddress: walletClient.account.address,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Trade failed");
      }

      setState({ status: "pending" });

      const data = await res.json();
      setState({ status: "success", orderId: data.orderId ?? "" });

      setTimeout(() => setState({ status: "idle" }), 3000);
    } catch (err) {
      setState({
        status: "error",
        message: err instanceof Error ? err.message : "Unknown error",
      });
      setTimeout(() => setState({ status: "idle" }), 4000);
    }
  }

  return { state, executeTrade };
}
