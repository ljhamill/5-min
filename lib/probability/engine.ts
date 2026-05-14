/**
 * Binary option pricer for Polymarket 5-minute markets.
 *
 * Prices a digital call: probability that underlying S ends above strike K
 * before expiry, given current price, realized vol, and time remaining.
 *
 * Formula: P(up) = N(d2)
 *   d2 = [ln(S/K) + (-σ²/2) * T] / (σ * √T)
 *
 * Ignores risk-free rate — negligible over 5-minute horizon.
 */

// Rational approximation of the cumulative normal distribution (Abramowitz & Stegun)
function cdf(x: number): number {
  if (x < -8) return 0;
  if (x > 8) return 1;
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const t = 1 / (1 + p * Math.abs(x) * 0.5);
  const poly = t * (a1 + t * (a2 + t * (a3 + t * (a4 + t * a5))));
  const erf = 1 - poly * Math.exp(-x * x * 0.5);
  // This is actually erfc-based; adjust to proper CDF
  return 0.5 * (1 + sign * erf);
}

export type ProbabilityInput = {
  currentPrice: number;  // S — live underlying price (e.g. 95000 for BTC)
  // For "Up or Down" markets, strikePrice = currentPrice (no fixed strike).
  // The probability reduces to ~50% ± momentum drift.
  strikePrice: number;   // K — market resolution level (or current price for up/down markets)
  direction: "above" | "below";
  secondsRemaining: number;
  annualizedVolatility: number; // σ — e.g. 0.80 for 80% annualized vol
  // Optional short-term momentum: % return over recent window (e.g. last 30s)
  // Positive = upward drift, negative = downward drift
  recentDrift?: number;
};

export type ProbabilityResult = {
  modelProbability: number; // 0–1, our estimate
  isValid: boolean;
  inputsUsed: ProbabilityInput;
};

export function calcProbability(input: ProbabilityInput): ProbabilityResult {
  const { currentPrice, strikePrice, direction, secondsRemaining, annualizedVolatility, recentDrift = 0 } = input;

  const invalid: ProbabilityResult = {
    modelProbability: 0.5,
    isValid: false,
    inputsUsed: input,
  };

  if (
    currentPrice <= 0 ||
    strikePrice <= 0 ||
    secondsRemaining <= 0 ||
    annualizedVolatility <= 0
  ) {
    return invalid;
  }

  // Convert seconds to fraction of a year
  const T = secondsRemaining / (365.25 * 24 * 3600);
  const sigma = annualizedVolatility;
  const S = currentPrice;
  const K = strikePrice;

  const sqrtT = Math.sqrt(T);

  // d2 includes short-term drift as an annualized mu estimate.
  // For up/down markets (S === K), ln(S/K) = 0, so only drift and vol terms remain.
  // recentDrift is a decimal (e.g. 0.001 = 0.1% per recent window);
  // we annualize it as a rough mu signal.
  const annualizedDrift = recentDrift * (365.25 * 24 * 3600 / 30); // assume drift measured over 30s
  const d2 =
    (Math.log(S / K) + (annualizedDrift - 0.5 * sigma * sigma) * T) /
    (sigma * sqrtT);

  // P(above K) = N(d2), P(below K) = 1 - N(d2)
  const pAbove = cdf(d2);
  const modelProbability = direction === "above" ? pAbove : 1 - pAbove;

  return {
    modelProbability: Math.max(0.01, Math.min(0.99, modelProbability)),
    isValid: true,
    inputsUsed: input,
  };
}

// Value gap: difference between model probability and market implied price
// Positive = model says higher prob than market → potential long value
// Negative = model says lower prob than market → potential short value
export function calcEdge(modelProb: number, marketPrice: number): number {
  return modelProb - marketPrice;
}

export function formatEdge(edge: number): string {
  const pct = (edge * 100).toFixed(1);
  return edge >= 0 ? `+${pct}%` : `${pct}%`;
}

export function edgeColor(edge: number): "green" | "red" | "neutral" {
  if (edge > 0.03) return "green";
  if (edge < -0.03) return "red";
  return "neutral";
}
