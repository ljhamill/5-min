export type PolymarketToken = {
  token_id: string;
  outcome: "Yes" | "No";
  price: number;
  winner: boolean;
};

export type PolymarketMarket = {
  id: string;
  question: string;
  slug: string;
  end_date_iso: string;
  window_start_iso?: string;   // ISO timestamp of the 5-min window start
  seconds_elapsed?: number;    // seconds since window opened
  seconds_remaining?: number;  // seconds until window closes
  window_progress?: number;    // 0–1, how far through the 5-min window
  tokens: PolymarketToken[];
  active: boolean;
  closed: boolean;
  tick_size: string;
  neg_risk: boolean;
  asset?: string;
  strike?: number;
  direction?: "above" | "below";
};

export type Orderbook = {
  market: string;
  asset_id: string;
  bids: { price: string; size: string }[];
  asks: { price: string; size: string }[];
  hash: string;
  timestamp: string;
};

export type OrderSide = "YES" | "NO";

export type TradeParams = {
  tokenId: string;
  amountUsdc: number;
  side: OrderSide;
};

export type TradeResult = {
  orderId?: string;
  transactionHash?: string;
  status: "success" | "error";
  error?: string;
};
