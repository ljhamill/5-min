"use client";

import { useEffect, useRef, useState } from "react";
import { getBestAsk, getBestBid, getMidPrice } from "@/lib/polymarket/markets";

type Level = { price: string; size: string };

export type OrderbookData = {
  bids: Level[];
  asks: Level[];
  bestBid: number;
  bestAsk: number;
  midPrice: number;
  spread: number;
};

const CLOB_WS = "wss://clob.polymarket.com/ws";

export function useOrderbook(tokenId: string | undefined) {
  const [book, setBook] = useState<OrderbookData | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!tokenId) return;

    function connect() {
      const ws = new WebSocket(CLOB_WS);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            auth: {},
            markets: [tokenId],
            type: "Market",
          }),
        );
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          const events = Array.isArray(msg) ? msg : [msg];

          for (const evt of events) {
            if (evt.event_type === "book") {
              const bids: Level[] = evt.bids ?? [];
              const asks: Level[] = evt.asks ?? [];
              const bestBid = getBestBid(bids);
              const bestAsk = getBestAsk(asks);
              const midPrice = getMidPrice(bids, asks);
              setBook({
                bids: bids.slice(0, 10),
                asks: asks.slice(0, 10),
                bestBid,
                bestAsk,
                midPrice,
                spread: bestAsk - bestBid,
              });
            }

            // Incremental price level updates
            if (evt.event_type === "price_change") {
              setBook((prev) => {
                if (!prev) return prev;
                // Re-derive from updated levels — simplified: refetch full book
                return prev;
              });
            }
          }
        } catch {}
      };

      ws.onerror = () => ws.close();
      ws.onclose = () => {
        reconnectTimer.current = setTimeout(connect, 2000);
      };
    }

    connect();

    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [tokenId]);

  return book;
}
