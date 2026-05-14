"use client";

import { useQuery } from "@tanstack/react-query";
import type { PolymarketMarket } from "@/lib/polymarket/types";

export function useMarkets() {
  return useQuery<PolymarketMarket[]>({
    queryKey: ["markets"],
    queryFn: async () => {
      const res = await fetch("/api/markets");
      if (!res.ok) throw new Error("Failed to fetch markets");
      return res.json();
    },
    refetchInterval: 30_000,
    staleTime: 20_000,
  });
}
