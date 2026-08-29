import { STOCK_SAMPLES } from "./stock-data";

export const INITIAL_CASH = 100_000;
export const INITIAL_BARS = 60;
export const STEP = 3;
export const MAX_ROUNDS = 10;
export const TOTAL_BARS = INITIAL_BARS + STEP * MAX_ROUNDS;

export type ReplayAction = {
  kind: "buy" | "sell" | "hold";
  allocation?: 0.25 | 0.5 | 1;
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

export function getChallenge(date: string) {
  const seed = hashText(`mangpan-${date}`);
  const stockIndex = seed % STOCK_SAMPLES.length;
  const maxStart = Math.max(0, STOCK_SAMPLES[stockIndex].candles.length - TOTAL_BARS);
  return {
    stockIndex,
    start: Math.floor(seed / STOCK_SAMPLES.length) % (maxStart + 1),
  };
}

export function replayChallenge(date: string, actions: ReplayAction[]) {
  const challenge = getChallenge(date);
  const stock = STOCK_SAMPLES[challenge.stockIndex];
  const factor = 100 / stock.candles[challenge.start + INITIAL_BARS - 1].close;
  const candles = stock.candles.map((candle) => ({
    ...candle,
    open: candle.open * factor,
    close: candle.close * factor,
  }));
  let cash = INITIAL_CASH;
  let shares = 0;
  let trades = 0;
  let rounds = 0;
  const equityHistory = [INITIAL_CASH];

  for (const action of actions.slice(0, MAX_ROUNDS)) {
    const executionIndex = challenge.start + INITIAL_BARS + rounds * STEP;
    const execution = candles[executionIndex]?.open;
    if (!execution) break;
    const allocation = action.allocation === 0.25 || action.allocation === 0.5 || action.allocation === 1 ? action.allocation : 1;

    if (action.kind === "buy" && cash > 0.01) {
      const spend = cash * allocation;
      cash -= spend;
      shares += spend / execution;
      if (spend > 0.01) trades++;
    } else if (action.kind === "sell" && shares > 0.000001) {
      const amount = shares * allocation;
      shares -= amount;
      cash += amount * execution;
      if (amount > 0.000001) trades++;
    }

    for (let step = 0; step < STEP; step++) {
      const close = candles[executionIndex + step]?.close;
      if (close == null) break;
      equityHistory.push(cash + shares * close);
    }
    rounds++;
    if (equityHistory[equityHistory.length - 1] <= INITIAL_CASH * 0.2) break;
  }

  const visibleIndex = challenge.start + INITIAL_BARS + rounds * STEP - 1;
  const current = candles[Math.max(challenge.start + INITIAL_BARS - 1, visibleIndex)];
  const initial = candles[challenge.start + INITIAL_BARS - 1];
  const equity = cash + shares * current.close;
  const returnRate = (equity / INITIAL_CASH - 1) * 100;
  const benchmark = (current.close / initial.close - 1) * 100;
  const excess = returnRate - benchmark;
  let peak = equityHistory[0];
  let maxDrawdown = 0;
  for (const value of equityHistory) {
    peak = Math.max(peak, value);
    maxDrawdown = Math.min(maxDrawdown, (value / peak - 1) * 100);
  }
  const score = Math.round(
    clamp(50 + excess * 2.5, 0, 100) * 0.5
      + clamp(100 + maxDrawdown * 5, 0, 100) * 0.3
      + clamp(100 - Math.max(0, trades - 4) * 12, 35, 100) * 0.2,
  );

  return { score, returnRate, benchmark, excess, maxDrawdown, trades, rounds };
}
