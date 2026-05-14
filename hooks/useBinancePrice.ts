"use client";

import { useEffect, useRef, useState } from "react";
import { BINANCE_SYMBOLS, calcRealizedVol } from "@/lib/binance/assets";

// Rolling window of prices for vol calculation (last 60 ticks = ~60 seconds)
const VOL_WINDOW = 60;

export type AssetData = {
  price: number;
  prevPrice: number;
  vol: number;        // annualized realized vol
  drift30s: number;   // log return over last ~30 ticks as a momentum signal
  lastUpdated: number;
};

export function useBinancePrices(assets: string[]) {
  const [data, setData] = useState<Record<string, AssetData>>({});
  const priceHistory = useRef<Record<string, number[]>>({});
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!assets.length) return;

    const uniqueAssets = [...new Set(assets)].filter((a) => BINANCE_SYMBOLS[a]);
    if (!uniqueAssets.length) return;

    const streams = uniqueAssets
      .map((a) => `${BINANCE_SYMBOLS[a]}@trade`)
      .join("/");

    function connect() {
      const ws = new WebSocket(
        `wss://stream.binance.com:9443/stream?streams=${streams}`,
      );
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const { data: payload } = JSON.parse(event.data);
          if (!payload || payload.e !== "trade") return;

          const symbol = payload.s as string; // e.g. "BTCUSDT"
          const asset = Object.entries(BINANCE_SYMBOLS).find(
            ([, sym]) => sym.toUpperCase() === symbol,
          )?.[0];
          if (!asset) return;

          const price = parseFloat(payload.p);

          setData((prev) => {
            const prevPrice = prev[asset]?.price ?? price;

            // Update rolling price history for vol
            const history = priceHistory.current[asset] ?? [];
            history.push(price);
            if (history.length > VOL_WINDOW) history.shift();
            priceHistory.current[asset] = history;

            const vol = calcRealizedVol(history);
            // 30-tick drift as log return (momentum signal)
            const drift30s =
              history.length >= 30
                ? Math.log(price / history[history.length - 30])
                : 0;

            return {
              ...prev,
              [asset]: { price, prevPrice, vol, drift30s, lastUpdated: Date.now() },
            };
          });
        } catch {}
      };

      ws.onerror = () => ws.close();
      ws.onclose = () => {
        // Reconnect after 2s unless component unmounted
        reconnectTimer.current = setTimeout(connect, 2000);
      };
    }

    connect();

    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [assets.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  return data;
}
