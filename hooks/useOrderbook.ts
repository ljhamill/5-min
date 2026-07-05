"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";

type Level = { price: string; size: string };

export type OrderbookData = {
  bids: Level[];
  asks: Level[];
  bestBid: number;
  bestAsk: number;
  midPrice: number;
  spread: number;
};

type OrderbookPayload = {
  tokenId: string;
  marketId: string;
  bids: Level[];
  asks: Level[];
  bestBid: number;
  bestAsk: number;
  midPrice: number;
  spread: number;
  ts: number;
};

// Module-level listener registry — one shared "orderbook" broadcast channel
// multiplexed across every useOrderbook() call, since the same channel name
// on the same client would otherwise collide (and a naive per-hook
// removeChannel() would tear down other mounted hooks' subscriptions).
type Listener = (payload: OrderbookPayload) => void;
const listeners = new Set<Listener>();
let sharedChannel: ReturnType<ReturnType<typeof getSupabase>["channel"]> | null = null;

function ensureChannel() {
  if (sharedChannel) return;
  const supabase = getSupabase();
  sharedChannel = supabase
    .channel("orderbook")
    .on("broadcast", { event: "orderbook" }, ({ payload }) => {
      for (const listener of listeners) listener(payload as OrderbookPayload);
    })
    .subscribe();
}

function releaseChannelIfUnused() {
  if (listeners.size === 0 && sharedChannel) {
    const supabase = getSupabase();
    supabase.removeChannel(sharedChannel);
    sharedChannel = null;
  }
}

export function useOrderbook(tokenId: string | undefined) {
  const [book, setBook] = useState<OrderbookData | null>(null);

  useEffect(() => {
    if (!tokenId) {
      setBook(null);
      return;
    }

    setBook(null);
    const supabase = getSupabase();

    // Seed from DB so the UI isn't blank while waiting for the next broadcast
    supabase
      .from("orderbook_state")
      .select("*")
      .eq("token_id", tokenId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error || !data) return;
        setBook({
          bids: data.bids as Level[],
          asks: data.asks as Level[],
          bestBid: data.best_bid ?? 0,
          bestAsk: data.best_ask ?? 1,
          midPrice: data.mid_price ?? 0.5,
          spread: data.spread ?? 0,
        });
      });

    const listener: Listener = (payload) => {
      if (payload.tokenId !== tokenId) return;
      setBook({
        bids: payload.bids,
        asks: payload.asks,
        bestBid: payload.bestBid,
        bestAsk: payload.bestAsk,
        midPrice: payload.midPrice,
        spread: payload.spread,
      });
    };

    listeners.add(listener);
    ensureChannel();

    return () => {
      listeners.delete(listener);
      releaseChannelIfUnused();
    };
  }, [tokenId]);

  return book;
}
