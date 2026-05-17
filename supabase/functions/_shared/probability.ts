// Binary option probability engine — server-side Deno version
// Mirrors lib/probability/engine.ts in the Next.js app

function cdf(x: number): number {
  const a1 =  0.254829592;
  const a2 = -0.284496736;
  const a3 =  1.421413741;
  const a4 = -1.453152027;
  const a5 =  1.061405429;
  const p  =  0.3275911;
  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x) / Math.sqrt(2);
  const t = 1 / (1 + p * absX);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);
  return 0.5 * (1 + sign * y);
}

export type ProbabilityInput = {
  currentPrice: number;
  strikePrice: number;
  direction: "above" | "below";
  secondsRemaining: number;
  annualizedVolatility: number;
  recentDrift?: number;
};

export type ProbabilityResult =
  | { isValid: true;  modelProbability: number }
  | { isValid: false; reason: string };

export function calcProbability(input: ProbabilityInput): ProbabilityResult {
  const { currentPrice, strikePrice, secondsRemaining, annualizedVolatility, recentDrift = 0, direction } = input;

  if (currentPrice <= 0 || strikePrice <= 0)
    return { isValid: false, reason: "invalid prices" };
  if (secondsRemaining <= 0)
    return { isValid: false, reason: "expired" };
  if (annualizedVolatility <= 0)
    return { isValid: false, reason: "no vol" };

  const S = currentPrice;
  const K = strikePrice;
  const T = secondsRemaining / (365.25 * 24 * 3600);
  const sigma = annualizedVolatility;
  const sqrtT = Math.sqrt(T);
  const annualizedDrift = recentDrift * (365.25 * 24 * 3600 / 30);
  const d2 = (Math.log(S / K) + (annualizedDrift - 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
  const pAbove = cdf(d2);
  const modelProbability = direction === "above" ? pAbove : 1 - pAbove;

  return { isValid: true, modelProbability };
}
