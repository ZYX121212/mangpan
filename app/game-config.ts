export const INITIAL_CASH = 100_000;
export const GAME_VERSION = "latest-horizon-v2";
export const INITIAL_BARS = 120;
export const MIN_FUTURE_BARS = 60;
export const MIN_GAME_BARS = INITIAL_BARS + MIN_FUTURE_BARS;
export const MAX_ACTIONS = 10_000;

export type MarketKind = "cn" | "us";
export const ORDER_ALLOCATIONS = [0.25, 1 / 3, 0.5, 0.75, 1] as const;
export type OrderAllocation = (typeof ORDER_ALLOCATIONS)[number];

export type ReplayAction = {
  kind: "buy" | "sell" | "hold";
  allocation?: number;
  quantity?: number;
  days?: 1 | 2 | 3 | 4 | 5;
};

export function isOrderAllocation(value: unknown): value is OrderAllocation {
  return typeof value === "number" && ORDER_ALLOCATIONS.some((allocation) => Math.abs(allocation - value) < 1e-9);
}

export function lotSizeFor(market: MarketKind) {
  return market === "cn" ? 100 : 1;
}

export function orderQuantity({
  market,
  kind,
  price,
  cash,
  shares,
  allocation = 1,
  quantity,
}: {
  market: MarketKind;
  kind: "buy" | "sell";
  price: number;
  cash: number;
  shares: number;
  allocation?: number;
  quantity?: number;
}) {
  const lot = lotSizeFor(market);
  const available = kind === "buy" ? Math.floor(cash / price / lot) * lot : Math.floor(shares + 1e-9);
  if (available <= 0) return 0;
  if (quantity !== undefined) {
    const requested = Math.floor(quantity / lot) * lot;
    return Math.max(0, Math.min(available, requested));
  }
  if (allocation >= 1) return available;
  const target = kind === "buy" ? cash * allocation / price : shares * allocation;
  return Math.max(0, Math.min(available, Math.floor(target / lot) * lot));
}

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
