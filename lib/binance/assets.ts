// Maps Polymarket asset tickers to Binance WebSocket stream symbols
export const BINANCE_SYMBOLS: Record<string, string> = {
  BTC:  "btcusdt",
  ETH:  "ethusdt",
  SOL:  "solusdt",
  BNB:  "bnbusdt",
  XRP:  "xrpusdt",
  DOGE: "dogeusdt",
  HYPE: "hypeusdt",
  ADA:  "adausdt",
};

// Derives all unique Binance stream names needed for a set of assets
export function streamsForAssets(assets: string[]): string[] {
  const unique = [...new Set(assets)];
  return unique
    .map((a) => BINANCE_SYMBOLS[a])
    .filter(Boolean)
    .map((sym) => `${sym}@trade`);
}

// Annualized vol estimate from a rolling window of log returns (1s ticks)
// Returns annualized vol as a decimal (e.g. 0.80 = 80%)
export function calcRealizedVol(prices: number[]): number {
  if (prices.length < 2) return 0.8; // fallback: 80% annualized
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    returns.push(Math.log(prices[i] / prices[i - 1]));
  }
  const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
  const variance =
    returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (returns.length - 1);
  // Annualize from 1-second ticks: multiply by seconds per year
  return Math.sqrt(variance * 365.25 * 24 * 3600);
}
