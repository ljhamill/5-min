// Fail-safe: anything other than the literal string "true" means disabled, so a
// fresh deploy with the env var unset always lands in view-only MVP mode.
export const TRADING_ENABLED = process.env.NEXT_PUBLIC_TRADING_ENABLED === "true";
