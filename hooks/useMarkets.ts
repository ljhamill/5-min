"use client";

import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabase } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";
import type { PolymarketMarket } from "@/lib/polymarket/types";

type MarketRow = Database["public"]["Tables"]["markets"]["Row"];

const ASSET_ORDER = ["BTC", "ETH", "SOL", "XRP", "BNB", "DOGE", "HYPE"];

function toPolymarketMarket(row: MarketRow): PolymarketMarket {
  const now = Date.now();
  const endTs = new Date(row.end_date).getTime();
  const startTs = row.window_start ? new Date(row.window_start).getTime() : 0;

  const secondsElapsed = startTs ? Math.max(0, Math.floor((now - startTs) / 1000)) : 0;
  const secondsRemaining = Math.max(0, Math.floor((endTs - now) / 1000));

  const metadata = (row.metadata ?? {}) as { neg_risk?: boolean; direction?: "above" | "below" };

  return {
    id: row.id,
    question: row.title,
    slug: row.source_slug ?? "",
    end_date_iso: row.end_date,
    window_start_iso: row.window_start ?? undefined,
    seconds_elapsed: secondsElapsed,
    seconds_remaining: secondsRemaining,
    window_progress: Math.min(1, secondsElapsed / row.window_seconds),
    tokens: [
      { token_id: row.token_yes_id ?? "", outcome: "Yes", price: row.price_yes ?? 0.5, winner: false },
      { token_id: row.token_no_id ?? "", outcome: "No", price: row.price_no ?? 0.5, winner: false },
    ],
    active: row.status === "active",
    closed: row.status === "closed",
    tick_size: row.tick_size,
    neg_risk: metadata.neg_risk ?? false,
    asset: row.asset ?? undefined,
    direction: metadata.direction ?? "above",
  };
}

async function fetchMarkets(): Promise<PolymarketMarket[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("markets")
    .select("*")
    .in("status", ["active", "upcoming"])
    .eq("accepting_orders", true)
    .order("window_start", { ascending: true });

  if (error) throw error;

  return (data ?? [])
    .map(toPolymarketMarket)
    .sort((a, b) => {
      const timeDiff = new Date(a.end_date_iso).getTime() - new Date(b.end_date_iso).getTime();
      if (timeDiff !== 0) return timeDiff;
      return ASSET_ORDER.indexOf(a.asset ?? "") - ASSET_ORDER.indexOf(b.asset ?? "");
    });
}

export function useMarkets() {
  const queryClient = useQueryClient();
  const lastInvalidate = useRef(0);

  useEffect(() => {
    const supabase = getSupabase();
    const channel = supabase
      .channel("markets-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "markets" },
        () => {
          const now = Date.now();
          if (now - lastInvalidate.current < 5_000) return;
          lastInvalidate.current = now;
          queryClient.invalidateQueries({ queryKey: ["markets"] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return useQuery<PolymarketMarket[]>({
    queryKey: ["markets"],
    queryFn: fetchMarkets,
    refetchInterval: 60_000,
    staleTime: 20_000,
  });
}
