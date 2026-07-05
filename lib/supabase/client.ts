import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

// Shared singleton — Realtime multiplexes all channel subscriptions over one
// WebSocket connection per client instance, so every hook must use this one.
let singleton: SupabaseClient<Database> | undefined;

export function getSupabase(): SupabaseClient<Database> {
  return (singleton ??= createClient());
}
