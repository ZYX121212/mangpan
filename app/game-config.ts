export const INITIAL_CASH = 1_000_000;
export const GAME_VERSION = "share-anywhere-v18";
export const INITIAL_BARS = 120;
export const MIN_FUTURE_BARS = 60;
export const MIN_GAME_BARS = INITIAL_BARS + MIN_FUTURE_BARS;
export const MAX_ACTIONS = 10_000;
export const DAILY_CHALLENGE_DECISIONS = 5;

export type MarketKind = "cn" | "us";
export const ORDER_ALLOCATIONS = [0.25, 1 / 3, 0.5, 0.75, 1] as const;
export type OrderAllocation = (typeof ORDER_ALLOCATIONS)[number];
export type MarketOutlook = "up" | "range" | "down";
export type DecisionThesis =
  "trend" | "breakout" | "reversal" | "volume" | "uncertain";
export type ConfidenceLevel = 1 | 2 | 3;
export type ProbabilityForecast = Record<MarketOutlook, number>;

export type ReplayAction = {
  kind: "buy" | "sell" | "hold";
  allocation?: number;
  quantity?: number;
  days?: 1 | 2 | 3 | 4 | 5;
  outlook?: MarketOutlook;
  thesis?: DecisionThesis;
  confidence?: ConfidenceLevel;
  probabilities?: ProbabilityForecast;
};

const FORECAST_OUTCOMES = ["up", "range", "down"] as const;

export function probabilityForecast(
  outlook: MarketOutlook,
  confidence: ConfidenceLevel,
): ProbabilityForecast {
  const dominant = confidence === 3 ? 80 : confidence === 2 ? 65 : 50;
  const remainder = (100 - dominant) / 2;
  return {
    up: outlook === "up" ? dominant : remainder,
    range: outlook === "range" ? dominant : remainder,
    down: outlook === "down" ? dominant : remainder,
  };
}

export function isProbabilityForecast(
  value: unknown,
): value is ProbabilityForecast {
  if (!value || typeof value !== "object") return false;
  const forecast = value as Partial<ProbabilityForecast>;
  const values = FORECAST_OUTCOMES.map((outcome) => forecast[outcome]);
  return (
    values.every(
      (probability) =>
        typeof probability === "number" &&
        Number.isFinite(probability) &&
        probability >= 0 &&
        probability <= 100,
    ) &&
    Math.abs(values.reduce((sum, probability) => sum + probability!, 0) - 100) <
      0.001
  );
}

export function forecastForAction(
  action: Pick<ReplayAction, "outlook" | "confidence" | "probabilities">,
) {
  if (isProbabilityForecast(action.probabilities)) return action.probabilities;
  if (action.outlook && action.confidence)
    return probabilityForecast(action.outlook, action.confidence);
  return null;
}

export function probabilityCalibrationScore(
  forecast: ProbabilityForecast,
  actual: MarketOutlook,
) {
  const brier = FORECAST_OUTCOMES.reduce((sum, outcome) => {
    const probability = forecast[outcome] / 100;
    const observed = outcome === actual ? 1 : 0;
    return sum + (probability - observed) ** 2;
  }, 0);
  return Math.round(clamp(100 - brier * 50, 0, 100) * 100) / 100;
}

export function isOrderAllocation(value: unknown): value is OrderAllocation {
  return (
    typeof value === "number" &&
    ORDER_ALLOCATIONS.some((allocation) => Math.abs(allocation - value) < 1e-9)
  );
}

export function lotSizeFor(market: MarketKind) {
  return market === "cn" ? 100 : 1;
}

const roundMoney = (value: number) => Math.round(value * 100) / 100;

export type TransactionQuote = {
  referencePrice: number;
  executionPrice: number;
  quantity: number;
  referenceGross: number;
  gross: number;
  commission: number;
  stampDuty: number;
  transferFee: number;
  regulatoryFee: number;
  slippageCost: number;
  totalFees: number;
  cashDelta: number;
};

/**
 * Deterministic training execution model. Statutory/regulatory charges follow
 * the current market side on which they are normally collected. Brokerage
 * commission and spread assumptions are intentionally explicit game settings.
 */
export function transactionQuote({
  market,
  kind,
  referencePrice,
  quantity,
}: {
  market: MarketKind;
  kind: "buy" | "sell";
  referencePrice: number;
  quantity: number;
}): TransactionQuote {
  const validQuantity = Math.max(0, Math.floor(quantity));
  const slippageRate = market === "cn" ? 0.0002 : 0.00015;
  const executionPrice =
    referencePrice * (1 + (kind === "buy" ? slippageRate : -slippageRate));
  const referenceGross = roundMoney(referencePrice * validQuantity);
  const gross = roundMoney(executionPrice * validQuantity);
  const commission =
    market === "cn" && validQuantity > 0
      ? roundMoney(Math.max(5, gross * 0.00025))
      : 0;
  const stampDuty =
    market === "cn" && kind === "sell" ? roundMoney(gross * 0.0005) : 0;
  const transferFee =
    market === "cn" ? roundMoney(gross * 0.00001) : 0;
  const regulatoryFee =
    market === "us" && kind === "sell"
      ? roundMoney(gross * 0.0000206 + Math.min(9.79, validQuantity * 0.000195))
      : 0;
  const totalFees = roundMoney(
    commission + stampDuty + transferFee + regulatoryFee,
  );
  // Derive slippage from the two displayed, cent-rounded amounts so the
  // breakdown always reconciles exactly for users.
  const slippageCost = roundMoney(Math.abs(gross - referenceGross));
  return {
    referencePrice,
    executionPrice,
    quantity: validQuantity,
    referenceGross,
    gross,
    commission,
    stampDuty,
    transferFee,
    regulatoryFee,
    slippageCost,
    totalFees,
    cashDelta: roundMoney(
      kind === "buy" ? -(gross + totalFees) : gross - totalFees,
    ),
  };
}

function affordableBuyQuantity(
  market: MarketKind,
  price: number,
  budget: number,
  lot: number,
) {
  let low = 0;
  let high = Math.max(0, Math.floor(budget / price / lot));
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const quantity = middle * lot;
    const quote = transactionQuote({
      market,
      kind: "buy",
      referencePrice: price,
      quantity,
    });
    if (-quote.cashDelta <= budget + 1e-9) low = middle + 1;
    else high = middle - 1;
  }
  return high * lot;
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
  const available =
    kind === "buy"
      ? affordableBuyQuantity(market, price, cash, lot)
      : Math.floor(shares + 1e-9);
  if (available <= 0) return 0;
  if (quantity !== undefined) {
    const requested = Math.floor(quantity / lot) * lot;
    return Math.max(0, Math.min(available, requested));
  }
  if (allocation >= 1) return available;
  if (kind === "buy")
    return Math.min(
      available,
      affordableBuyQuantity(market, price, cash * allocation, lot),
    );
  const target = shares * allocation;
  return Math.max(0, Math.min(available, Math.floor(target / lot) * lot));
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function initialBarsFor(stock: {
  candles: unknown[];
  initialVisibleCount?: number;
}) {
  const latestAllowed = Math.max(INITIAL_BARS, stock.candles.length);
  const requested = Number.isInteger(stock.initialVisibleCount)
    ? (stock.initialVisibleCount as number)
    : INITIAL_BARS;
  return clamp(requested, INITIAL_BARS, latestAllowed);
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
