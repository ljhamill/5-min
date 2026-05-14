import { NextRequest, NextResponse } from "next/server";

/**
 * Trade proxy route.
 *
 * NOTE: Full implementation requires the Polymarket CLOB client to be
 * initialized with the user's wallet signer. Because signing must happen
 * client-side (user's private key never leaves the browser), the recommended
 * pattern is:
 *
 *   1. Client builds & signs the order using @polymarket/clob-client-v2
 *      with their wagmi walletClient as the viem signer.
 *   2. Client POSTs the signed order bytes to this route.
 *   3. This route appends the builder code & fee, then forwards to CLOB.
 *
 * The stub below returns a mock success so the UI can be developed and
 * tested independently. Replace with real CLOB forwarding once you have
 * your builder API credentials.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { tokenId, amountUsdc, side, walletAddress } = body;

  if (!tokenId || !amountUsdc || !side || !walletAddress) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // TODO: Replace with real CLOB order placement
  // const builderCode = process.env.POLYMARKET_BUILDER_CODE;
  // const client = new ClobClient({ host: "https://clob.polymarket.com", ... });
  // const result = await client.createAndPostMarketOrder({ tokenID: tokenId, amount: amountUsdc, side, builderCode }, ...);

  // Stub response
  return NextResponse.json({
    orderId: `stub-${Date.now()}`,
    status: "submitted",
    note: "Replace this stub with real CLOB integration",
  });
}
