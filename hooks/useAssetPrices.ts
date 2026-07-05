"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";

export type AssetData = {
  price: number;
  prevPrice: number;
  vol: number;        // annualized realized vol
  drift30s: number;   // log return over last ~30 ticks as a momentum signal
  lastUpdated: number;
};

type PricePayload = {
  asset: string;
  price: number;
  prevPrice: number;
  volAnn: number;
  drift30s: number;
  probUpdates?: Record<string, { prob: number; edge: number }>;
  ts: number;
};

const RECONNECT_DELAY = 2_000;

export function useAssetPrices() {
  const [data, setData] = useState<Record<string, AssetData>>({});
  const [probByMarket, setProbByMarket] = useState<Record<string, { prob: number; edge: number }>>({});

  useEffect(() => {
    const supabase = getSupabase();
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    // Seed initial state from DB so the UI isn't blank while waiting for broadcasts
    supabase
      .from("asset_prices")
      .select("*")
      .then(({ data: rows, error }) => {
        if (error || !rows || cancelled) return;
        setData((prev) => {
          const next = { ...prev };
          for (const row of rows) {
            if (next[row.asset]) continue; // don't clobber a broadcast that already arrived
            next[row.asset] = {
              price: row.price,
              prevPrice: row.price_prev ?? row.price,
              vol: row.vol_ann ?? 0.8,
              drift30s: row.drift_30s ?? 0,
              lastUpdated: new Date(row.updated_at).getTime(),
            };
          }
          return next;
        });
      });

    function subscribe() {
      channel = supabase
        .channel("asset-prices")
        .on("broadcast", { event: "price" }, ({ payload }) => {
          const p = payload as PricePayload;
          setData((prev) => ({
            ...prev,
            [p.asset]: {
              price: p.price,
              prevPrice: p.prevPrice,
              vol: p.volAnn,
              drift30s: p.drift30s,
              lastUpdated: p.ts,
            },
          }));
          if (p.probUpdates) {
            setProbByMarket((prev) => ({ ...prev, ...p.probUpdates }));
          }
        })
        .subscribe((status) => {
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            if (channel) supabase.removeChannel(channel);
            reconnectTimer = setTimeout(() => {
              if (!cancelled) subscribe();
            }, RECONNECT_DELAY);
          }
        });
    }

    subscribe();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  return { prices: data, probByMarket };
}

// Convenience wrapper matching the old useBinancePrices() shape for existing
// components that only need the price map.
export function useAssetPricesMap(): Record<string, AssetData> {
  return useAssetPrices().prices;
}
