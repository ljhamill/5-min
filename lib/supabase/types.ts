export type Database = {
  public: {
    Tables: {
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
