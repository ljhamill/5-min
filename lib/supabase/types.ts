export type Database = {
  public: {
    Tables: {
      markets: {
        Row: {
          id: string;
          source: string;
          source_id: string;
          source_slug: string | null;
          market_type: string;
          title: string;
          description: string | null;
          asset: string | null;
          window_start: string | null;
          end_date: string;
          window_seconds: number;
          token_yes_id: string | null;
          token_no_id: string | null;
          tick_size: string;
          price_yes: number | null;
          price_no: number | null;
          mid_price: number | null;
          model_prob: number | null;
          edge: number | null;
          vol_ann: number | null;
          drift_used: number | null;
          prob_history: { ts: number; prob: number; mid: number }[];
          status: string;
          accepting_orders: boolean;
          metadata: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["markets"]["Row"]> & {
          id: string;
          source: string;
          source_id: string;
          market_type: string;
          title: string;
          end_date: string;
        };
        Update: Partial<Database["public"]["Tables"]["markets"]["Row"]>;
        Relationships: [];
      };
      asset_prices: {
        Row: {
          asset: string;
          price_source: string;
          price: number;
          price_prev: number | null;
          vol_ann: number | null;
          drift_30s: number | null;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["asset_prices"]["Row"]> & {
          asset: string;
          price: number;
        };
        Update: Partial<Database["public"]["Tables"]["asset_prices"]["Row"]>;
        Relationships: [];
      };
      orderbook_state: {
        Row: {
          token_id: string;
          market_id: string | null;
          source: string;
          bids: { price: string; size: string }[];
          asks: { price: string; size: string }[];
          best_bid: number | null;
          best_ask: number | null;
          mid_price: number | null;
          spread: number | null;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["orderbook_state"]["Row"]> & {
          token_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["orderbook_state"]["Row"]>;
        Relationships: [];
      };
      users: {
        Row: {
          wallet_address: string;
          first_seen_at: string;
          last_seen_at: string;
        };
        Insert: {
          wallet_address: string;
          first_seen_at?: string;
          last_seen_at?: string;
        };
        Update: {
          wallet_address?: string;
          first_seen_at?: string;
          last_seen_at?: string;
        };
        Relationships: [];
      };
      fee_config: {
        Row: {
          id: number;
          fee_bps: number;
          updated_at: string;
          updated_by: string;
        };
        Insert: {
          fee_bps: number;
          updated_at?: string;
          updated_by: string;
        };
        Update: {
          fee_bps?: number;
          updated_at?: string;
          updated_by?: string;
        };
        Relationships: [];
      };
      trades: {
        Row: {
          id: string;
          wallet_address: string;
          market_id: string;
          side: "YES" | "NO";
          amount_usdc: number;
          price: number;
          tx_hash: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          wallet_address: string;
          market_id: string;
          side: "YES" | "NO";
          amount_usdc: number;
          price: number;
          tx_hash?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          wallet_address?: string;
          market_id?: string;
          side?: "YES" | "NO";
          amount_usdc?: number;
          price?: number;
          tx_hash?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
