export const INITIAL_CASH = 100_000;
export const GAME_VERSION = "market-v1";
export const INITIAL_BARS = 120;
export const HORIZON_DAYS = 60;
export const MAX_ACTIONS = HORIZON_DAYS;
export const TOTAL_BARS = INITIAL_BARS + HORIZON_DAYS;

export type MarketKind = "cn" | "us";

export type ReplayAction = {
  kind: "buy" | "sell" | "hold";
  allocation?: 0.25 | 0.5 | 1;
  days?: 1 | 2 | 3 | 4 | 5;
};

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function hashText(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function chinaDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
