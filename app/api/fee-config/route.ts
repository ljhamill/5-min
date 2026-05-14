import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ADMIN_ADDRESS = process.env.ADMIN_WALLET_ADDRESS?.toLowerCase();

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fee_config")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1)
    .single();

  if (error) {
    return NextResponse.json({ fee_bps: 0 });
  }
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { fee_bps, wallet_address } = body;

  if (!ADMIN_ADDRESS || wallet_address?.toLowerCase() !== ADMIN_ADDRESS) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  if (typeof fee_bps !== "number" || fee_bps < 0 || fee_bps > 10000) {
    return NextResponse.json({ error: "fee_bps must be 0–10000" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fee_config")
    .insert({ fee_bps, updated_by: wallet_address })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}
