export function getBestBid(bids: { price: string; size: string }[]): number {
  if (!bids.length) return 0;
  return Math.max(...bids.map((b) => parseFloat(b.price)));
}

export function getBestAsk(asks: { price: string; size: string }[]): number {
  if (!asks.length) return 1;
  return Math.min(...asks.map((a) => parseFloat(a.price)));
}

export function getMidPrice(
  bids: { price: string; size: string }[],
  asks: { price: string; size: string }[],
): number {
  const bid = getBestBid(bids);
  const ask = getBestAsk(asks);
  return (bid + ask) / 2;
}
