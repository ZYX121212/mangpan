import type { StockSample } from "./stock-data";
import { INITIAL_CASH, MAX_ACTIONS, clamp, initialBarsFor, isOrderAllocation, orderQuantity, type MarketKind, type ReplayAction } from "./game-config";

export { GAME_VERSION, INITIAL_BARS, INITIAL_CASH, MAX_ACTIONS, MIN_FUTURE_BARS, MIN_GAME_BARS, clamp, chinaDate, isOrderAllocation, type MarketKind, type ReplayAction } from "./game-config";

export function replayChallenge(stock: StockSample, actions: ReplayAction[], market: MarketKind = "cn") {
  const initialBars = initialBarsFor(stock);
  const factor = 100 / stock.candles[initialBars - 1].close;
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
  const availableDays = Math.max(0, candles.length - initialBars);
  const equityHistory = [INITIAL_CASH];

  for (const action of actions.slice(0, MAX_ACTIONS)) {
    if (advancedDays >= availableDays) break;
    const executionIndex = initialBars + advancedDays;
    const execution = candles[executionIndex]?.open;
    if (!execution) break;
    const allocation = isOrderAllocation(action.allocation) ? action.allocation : 1;
    const requestedDays = action.days && action.days >= 1 && action.days <= 5 ? action.days : 3;
    const holdingDays = Math.min(requestedDays, availableDays - advancedDays);

    if (action.kind === "buy" && cash > 0.01) {
      const amount = orderQuantity({ market, kind: "buy", price: execution, cash, shares, allocation, quantity: action.quantity });
      const spend = amount * execution;
      cash -= spend;
      shares += amount;
      if (amount > 0) trades++;
    } else if (action.kind === "sell" && shares > 0.000001) {
      const amount = orderQuantity({ market, kind: "sell", price: execution, cash, shares, allocation, quantity: action.quantity });
      shares -= amount;
      cash += amount * execution;
      if (amount > 0) trades++;
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

  const visibleIndex = initialBars + advancedDays - 1;
  const current = candles[Math.max(initialBars - 1, visibleIndex)];
  const initial = candles[initialBars - 1];
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
