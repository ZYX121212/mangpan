import { STOCK_SAMPLES } from "./stock-data";
import { GAME_VERSION, HORIZON_DAYS, INITIAL_BARS, INITIAL_CASH, MAX_ACTIONS, TOTAL_BARS, clamp, hashText, type ReplayAction } from "./game-config";

export { GAME_VERSION, HORIZON_DAYS, INITIAL_BARS, INITIAL_CASH, MAX_ACTIONS, TOTAL_BARS, clamp, chinaDate, type ReplayAction } from "./game-config";

export function getChallenge(date: string) {
  const seed = hashText(`mangpan-${GAME_VERSION}-${date}`);
  const stockIndex = seed % STOCK_SAMPLES.length;
  const maxStart = Math.max(0, STOCK_SAMPLES[stockIndex].candles.length - TOTAL_BARS);
  return {
    stockIndex,
    start: Math.floor(seed / STOCK_SAMPLES.length) % (maxStart + 1),
  };
}

export function getChallengeBundle(date: string) {
  const challenge = getChallenge(date);
  const stock = STOCK_SAMPLES[challenge.stockIndex];
  return {
    date,
    stock: {
      code: stock.code,
      name: stock.name,
      market: stock.market,
      candles: stock.candles.slice(challenge.start, challenge.start + TOTAL_BARS),
    },
  };
}

export function getPracticeBundle(seed: string) {
  const value = hashText(`practice-${GAME_VERSION}-${seed}`);
  const stockIndex = value % STOCK_SAMPLES.length;
  const stock = STOCK_SAMPLES[stockIndex];
  const maxStart = Math.max(0, stock.candles.length - TOTAL_BARS);
  const start = Math.floor(value / STOCK_SAMPLES.length) % (maxStart + 1);
  return {
    date: "practice",
    stock: {
      code: stock.code,
      name: stock.name,
      market: stock.market,
      candles: stock.candles.slice(start, start + TOTAL_BARS),
    },
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
  let advancedDays = 0;
  const equityHistory = [INITIAL_CASH];

  for (const action of actions.slice(0, MAX_ACTIONS)) {
    if (advancedDays >= HORIZON_DAYS) break;
    const executionIndex = challenge.start + INITIAL_BARS + advancedDays;
    const execution = candles[executionIndex]?.open;
    if (!execution) break;
    const allocation = action.allocation === 0.25 || action.allocation === 0.5 || action.allocation === 1 ? action.allocation : 1;
    const requestedDays = action.days && action.days >= 1 && action.days <= 5 ? action.days : 3;
    const holdingDays = Math.min(requestedDays, HORIZON_DAYS - advancedDays);

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

    for (let step = 0; step < holdingDays; step++) {
      const close = candles[executionIndex + step]?.close;
      if (close == null) break;
      equityHistory.push(cash + shares * close);
    }
    advancedDays += holdingDays;
    rounds++;
    if (equityHistory[equityHistory.length - 1] <= INITIAL_CASH * 0.2) break;
  }

  const visibleIndex = challenge.start + INITIAL_BARS + advancedDays - 1;
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
  const allowedTrades = Math.max(4, Math.ceil(advancedDays / 10) + 1);
  const score = Math.round(
    clamp(50 + excess * 2.5, 0, 100) * 0.5
      + clamp(100 + maxDrawdown * 5, 0, 100) * 0.3
      + clamp(100 - Math.max(0, trades - allowedTrades) * 10, 35, 100) * 0.2,
  );

  return { score, returnRate, benchmark, excess, maxDrawdown, trades, rounds, advancedDays };
}
