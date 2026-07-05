"use client";

import { useEffect, useState } from "react";
import type { UTCTimestamp } from "lightweight-charts";
import { getSupabase } from "@/lib/supabase/client";
import { subscribeOrderbook } from "@/hooks/useOrderbook";
import { subscribeAssetPrices } from "@/hooks/useAssetPrices";

export type HistoryPoint = { time: UTCTimestamp; value: number };

// Lightweight Charts rejects non-monotonic/duplicate timestamps. Two writers
// (orderbook-stream, chainlink-price-stream) can land ticks in the same
// second — keep the latest value per second, drop anything older than the
// last point already in the series.
function appendPoint(arr: HistoryPoint[], time: UTCTimestamp, value: number): HistoryPoint[] {
  const last = arr[arr.length - 1];
  if (last && last.time === time) {
    const copy = arr.slice();
    copy[copy.length - 1] = { time, value };
    return copy;
  }
  if (last && time < last.time) return arr;
  return [...arr, { time, value }];
}

export function useMarketHistory(marketId: string | undefined) {
  const [midSeries, setMidSeries] = useState<HistoryPoint[]>([]);
  const [probSeries, setProbSeries] = useState<HistoryPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setMidSeries([]);
    setProbSeries([]);

    if (!marketId) return;

    let cancelled = false;
    setIsLoading(true);
    const supabase = getSupabase();

    // Seed full market-lifetime history in one query
    supabase
      .from("market_ticks")
      .select("ts, mid_price, model_prob")
      .eq("market_id", marketId)
      .order("ts", { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        setIsLoading(false);
        if (error || !data) return;

        let mid: HistoryPoint[] = [];
        let prob: HistoryPoint[] = [];
        for (const row of data) {
          const t = Math.floor(new Date(row.ts).getTime() / 1000) as UTCTimestamp;
          if (row.mid_price !== null) mid = appendPoint(mid, t, row.mid_price);
          if (row.model_prob !== null) prob = appendPoint(prob, t, row.model_prob);
        }
        setMidSeries(mid);
        setProbSeries(prob);
      });

    // Live tail — reuse the existing shared broadcast channels, no new subscriptions
    const unsubOrderbook = subscribeOrderbook((payload) => {
      if (payload.marketId !== marketId) return;
      const t = Math.floor(payload.ts / 1000) as UTCTimestamp;
      setMidSeries((prev) => appendPoint(prev, t, payload.midPrice));
    });

    const unsubPrices = subscribeAssetPrices((payload) => {
      const update = payload.probUpdates?.[marketId];
      if (!update) return;
      const t = Math.floor(payload.ts / 1000) as UTCTimestamp;
      setProbSeries((prev) => appendPoint(prev, t, update.prob));
    });

    return () => {
      cancelled = true;
      unsubOrderbook();
      unsubPrices();
    };
  }, [marketId]);

  return { midSeries, probSeries, isLoading };
}
