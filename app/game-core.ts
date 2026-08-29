import type { StockSample } from "./stock-data";
import {
  INITIAL_CASH,
  MAX_ACTIONS,
  clamp,
  initialBarsFor,
  isOrderAllocation,
  orderQuantity,
  transactionQuote,
  type MarketKind,
  type ReplayAction,
} from "./game-config";

export {
  GAME_VERSION,
  INITIAL_BARS,
  INITIAL_CASH,
  MAX_ACTIONS,
  MIN_FUTURE_BARS,
  MIN_GAME_BARS,
  clamp,
  chinaDate,
  isOrderAllocation,
  type ConfidenceLevel,
  type DecisionThesis,
  type MarketKind,
  type MarketOutlook,
  type ReplayAction,
} from "./game-config";

export function replayChallenge(
  stock: StockSample,
  actions: ReplayAction[],
  market: MarketKind = "cn",
) {
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
  let predictionWeight = 0;
  let predictionHits = 0;
  let confidentMisses = 0;
  let tradeEdgeTotal = 0;
  let tradeEdgeSamples = 0;
  let peakExposure = 0;
  let feesPaid = 0;
  let slippagePaid = 0;

  for (const action of actions.slice(0, MAX_ACTIONS)) {
    if (advancedDays >= availableDays) break;
    const executionIndex = initialBars + advancedDays;
    const execution = candles[executionIndex]?.open;
    if (!execution) break;
    const allocation = isOrderAllocation(action.allocation)
      ? action.allocation
      : 1;
    const requestedDays =
      action.days && action.days >= 1 && action.days <= 5 ? action.days : 3;
    const holdingDays = Math.min(requestedDays, availableDays - advancedDays);
    const outcomeClose = candles[executionIndex + holdingDays - 1]?.close;
    const outcomeReturn =
      outcomeClose != null ? (outcomeClose / execution - 1) * 100 : 0;
    if (outcomeClose != null && action.outlook && action.confidence) {
      const actual =
        outcomeReturn > 0.75 ? "up" : outcomeReturn < -0.75 ? "down" : "range";
      const weight =
        action.confidence === 3 ? 2 : action.confidence === 2 ? 1.5 : 1;
      predictionWeight += weight;
      if (action.outlook === actual) predictionHits += weight;
      else if (action.confidence === 3) confidentMisses++;
    }

    if (action.kind === "buy" && cash > 0.01) {
      const amount = orderQuantity({
        market,
        kind: "buy",
        price: execution,
        cash,
        shares,
        allocation,
        quantity: action.quantity,
      });
      const quote = transactionQuote({
        market,
        kind: "buy",
        referencePrice: execution,
        quantity: amount,
      });
      cash += quote.cashDelta;
      shares += amount;
      if (amount > 0) {
        feesPaid += quote.totalFees;
        slippagePaid += quote.slippageCost;
        trades++;
        tradeEdgeTotal +=
          outcomeClose != null
            ? (outcomeClose / quote.executionPrice - 1) * 100
            : 0;
        tradeEdgeSamples++;
      }
    } else if (action.kind === "sell" && shares > 0.000001) {
      const amount = orderQuantity({
        market,
        kind: "sell",
        price: execution,
        cash,
        shares,
        allocation,
        quantity: action.quantity,
      });
      const quote = transactionQuote({
        market,
        kind: "sell",
        referencePrice: execution,
        quantity: amount,
      });
      shares -= amount;
      cash += quote.cashDelta;
      if (amount > 0) {
        feesPaid += quote.totalFees;
        slippagePaid += quote.slippageCost;
        trades++;
        tradeEdgeTotal -=
          outcomeClose != null
            ? (outcomeClose / quote.executionPrice - 1) * 100
            : 0;
        tradeEdgeSamples++;
      }
    }

    for (let step = 0; step < holdingDays; step++) {
      const close = candles[executionIndex + step]?.close;
      if (close == null) break;
      const stepEquity = cash + shares * close;
      equityHistory.push(stepEquity);
      peakExposure = Math.max(
        peakExposure,
        stepEquity > 0 ? ((shares * close) / stepEquity) * 100 : 0,
      );
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
  const directionAccuracy = predictionWeight
    ? (predictionHits / predictionWeight) * 100
    : 50;
  const calibrationScore = clamp(
    directionAccuracy - confidentMisses * 4,
    0,
    100,
  );
  const riskScore = clamp(100 + maxDrawdown * 6, 0, 100);
  const executionScore = tradeEdgeSamples
    ? clamp(50 + (tradeEdgeTotal / tradeEdgeSamples) * 6, 0, 100)
    : 50;
  const disciplineScore = clamp(
    100 -
      Math.max(0, trades - allowedTrades) * 12 -
      Math.max(0, peakExposure - 85) * 0.6,
    35,
    100,
  );
  const performanceScore = clamp(50 + excess * 2, 0, 100);
  const score = Math.round(
    riskScore * 0.3 +
      calibrationScore * 0.25 +
      executionScore * 0.2 +
      disciplineScore * 0.15 +
      performanceScore * 0.1,
  );

  return {
    score,
    returnRate,
    benchmark,
    excess,
    maxDrawdown,
    trades,
    rounds,
    advancedDays,
    feesPaid,
    slippagePaid,
    directionAccuracy,
    calibrationScore,
    confidentMisses,
    processScores: {
      risk: riskScore,
      calibration: calibrationScore,
      execution: executionScore,
      discipline: disciplineScore,
      performance: performanceScore,
    },
  };
}

export function evaluateScenarioPass(
  scenario: "random" | "trend" | "reversal" | "crash" | "volatile",
  difficulty: "starter" | "standard" | "expert",
  result: ReturnType<typeof replayChallenge>,
) {
  if (scenario === "random") return false;
  const target = {
    starter: { days: 20, drawdown: -15, accuracy: 35, excess: -3 },
    standard: { days: 40, drawdown: -10, accuracy: 45, excess: 0 },
    expert: { days: 60, drawdown: -7, accuracy: 55, excess: 3 },
  }[difficulty];
  const focusPassed =
    scenario === "reversal"
      ? result.confidentMisses <= 1 && result.rounds >= 3
      : scenario === "volatile"
        ? (result.trades / Math.max(1, result.advancedDays)) * 20 <= 6
        : result.excess >= target.excess;
  return (
    result.advancedDays >= target.days &&
    result.maxDrawdown >= target.drawdown &&
    result.rounds >= 3 &&
    result.directionAccuracy >= target.accuracy &&
    focusPassed
  );
}
