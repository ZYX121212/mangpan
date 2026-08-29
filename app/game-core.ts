import { STOCK_SAMPLES } from "./stock-data";
import { US_STOCK_SAMPLES } from "./us-stock-data";
import { GAME_VERSION, HORIZON_DAYS, INITIAL_BARS, INITIAL_CASH, MAX_ACTIONS, TOTAL_BARS, clamp, hashText, type MarketKind, type ReplayAction } from "./game-config";

export { GAME_VERSION, HORIZON_DAYS, INITIAL_BARS, INITIAL_CASH, MAX_ACTIONS, TOTAL_BARS, clamp, chinaDate, type MarketKind, type ReplayAction } from "./game-config";

const MARKET_POOLS = { cn: STOCK_SAMPLES, us: US_STOCK_SAMPLES } satisfies Record<MarketKind, typeof STOCK_SAMPLES>;

export function getChallenge(date: string, market: MarketKind = "cn") {
  const pool = MARKET_POOLS[market];
  const seed = hashText(`mangpan-${GAME_VERSION}-${market}-${date}`);
  const stockIndex = seed % pool.length;
  const maxStart = Math.max(0, pool[stockIndex].candles.length - TOTAL_BARS);
  return {
    stockIndex,
    start: Math.floor(seed / pool.length) % (maxStart + 1),
  };
}

export function getChallengeBundle(date: string, market: MarketKind = "cn") {
  const pool = MARKET_POOLS[market];
  const challenge = getChallenge(date, market);
  const stock = pool[challenge.stockIndex];
  return {
    date,
    market,
    stock: {
      code: stock.code,
      name: stock.name,
      market: stock.market,
      assetClass: stock.assetClass,
      candles: stock.candles.slice(challenge.start, challenge.start + TOTAL_BARS),
    },
  };
}

export function getPracticeBundle(seed: string, market: MarketKind = "cn") {
  const pool = MARKET_POOLS[market];
  const value = hashText(`practice-${GAME_VERSION}-${market}-${seed}`);
  const stockIndex = value % pool.length;
  const stock = pool[stockIndex];
  const maxStart = Math.max(0, stock.candles.length - TOTAL_BARS);
  const start = Math.floor(value / pool.length) % (maxStart + 1);
  return {
    date: "practice",
    market,
    stock: {
      code: stock.code,
      name: stock.name,
      market: stock.market,
      assetClass: stock.assetClass,
      candles: stock.candles.slice(start, start + TOTAL_BARS),
    },
  };
}

export function replayChallenge(date: string, actions: ReplayAction[], market: MarketKind = "cn") {
  const pool = MARKET_POOLS[market];
  const challenge = getChallenge(date, market);
  const stock = pool[challenge.stockIndex];
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
