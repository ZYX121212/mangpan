import { CN_STOCK_UNIVERSE, type CnStockEntry } from "./cn-stock-universe";
import {
  GAME_VERSION,
  INITIAL_BARS,
  MIN_FUTURE_BARS,
  MIN_GAME_BARS,
  hashText,
  marketDate,
  type MarketKind,
} from "./game-config";
import {
  MARKET_UNIVERSE_SIZE,
  type Candle,
  type StockSample,
} from "./stock-types";

export type ChallengeBundle = {
  date: string;
  market: MarketKind;
  stock: StockSample;
  universeSize: number;
  dataSource: "live-universe" | "embedded-fallback";
};
export type ScenarioKind =
  "random" | "trend" | "reversal" | "crash" | "volatile";
export type ScenarioDifficulty = "starter" | "standard" | "expert";

const EXCHANGE_LABELS = { sh: "上证", sz: "深证", bj: "北证" } as const;
const HISTORY_PAGE_SIZE = 640;
const CN_MARKET_START = "1990-12-01";
const HISTORY_WINDOW_YEARS = 2;
const HISTORY_FETCH_CONCURRENCY = 6;

function scenarioScore(
  candles: Candle[],
  index: number,
  scenario: ScenarioKind,
) {
  const close = candles[index - 1].close;
  const returnFrom = (days: number) =>
    close / candles[Math.max(0, index - days)].close - 1;
  const dailyMoves = candles
    .slice(Math.max(1, index - 30), index)
    .map((candle, offset, values) => {
      const previous = offset
        ? values[offset - 1]
        : candles[Math.max(0, index - 31)];
      return Math.abs(candle.close / previous.close - 1);
    });
  const volatility =
    dailyMoves.reduce((sum, value) => sum + value, 0) /
    Math.max(1, dailyMoves.length);
  const longMove = returnFrom(60),
    shortMove = returnFrom(7);
  if (scenario === "trend") return Math.abs(longMove) * 2 + Math.abs(shortMove);
  if (scenario === "reversal")
    return (
      Math.abs(longMove) +
      (Math.sign(longMove) !== Math.sign(shortMove)
        ? Math.abs(shortMove) * 4
        : 0)
    );
  if (scenario === "crash") return -returnFrom(25) * 3 + volatility;
  if (scenario === "volatile") return volatility * 5 + Math.abs(shortMove);
  return 0;
}

function prepareGameStock(
  stock: StockSample,
  seed: number,
  scenario: ScenarioKind = "random",
  difficulty: ScenarioDifficulty = "standard",
) {
  if (stock.candles.length < MIN_GAME_BARS) return null;
  if (scenario !== "random" && stock.candles.length < INITIAL_BARS + 240)
    return null;
  const scenarioFutureBars = 240;
  const latestDecisionIndex =
    stock.candles.length -
    (scenario === "random" ? MIN_FUTURE_BARS : scenarioFutureBars);
  let decisionIndex = INITIAL_BARS;
  if (scenario !== "random") {
    const candidates: { index: number; score: number }[] = [];
    for (let index = INITIAL_BARS; index <= latestDecisionIndex; index += 5)
      candidates.push({
        index,
        score: scenarioScore(stock.candles, index, scenario),
      });
    candidates.sort(
      (a, b) =>
        b.score - a.score || ((a.index + seed) % 97) - ((b.index + seed) % 97),
    );
    const candidateShare =
      difficulty === "starter" ? 0.35 : difficulty === "standard" ? 0.12 : 0.03;
    const candidatePool = candidates.slice(
      0,
      Math.max(1, Math.ceil(candidates.length * candidateShare)),
    );
    decisionIndex =
      candidatePool[seed % candidatePool.length]?.index ?? decisionIndex;
  }
  return { ...stock, initialVisibleCount: decisionIndex } as StockSample;
}

async function bundledStock(
  seed: number,
  market: MarketKind,
  scenario: ScenarioKind = "random",
  difficulty: ScenarioDifficulty = "standard",
) {
  const pool =
    market === "cn"
      ? (await import("./stock-data")).STOCK_SAMPLES
      : (await import("./us-stock-data")).US_STOCK_SAMPLES;
  const stock = pool[seed % pool.length];
  return prepareGameStock(stock, seed, scenario, difficulty) ?? stock;
}

function parseTencentCandles(payload: unknown, symbol: string) {
  const root = payload as {
    data?: Record<string, { qfqday?: unknown[]; day?: unknown[] }>;
  };
  const stock = root?.data?.[symbol];
  const rows = stock?.qfqday ?? stock?.day ?? [];
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row) => {
    if (!Array.isArray(row) || row.length < 6) return [];
    const [date, open, close, high, low, volume] = row;
    const candle: Candle = {
      date: String(date),
      open: Number(open),
      close: Number(close),
      high: Number(high),
      low: Number(low),
      volume: Number(volume),
    };
    return /^\d{4}-\d{2}-\d{2}$/.test(candle.date) &&
      Object.values(candle).every(
        (value) => typeof value === "string" || Number.isFinite(value),
      )
      ? [candle]
      : [];
  });
}

async function loadCnStock(
  entry: CnStockEntry,
  endDate: string,
  seed: number,
  scenario: ScenarioKind = "random",
  difficulty: ScenarioDifficulty = "standard",
) {
  const symbol = `${entry.exchange}${entry.code}`;
  const fetchCandles = async (requestedEnd: string) => {
    const url = new URL("https://web.ifzq.gtimg.cn/appstock/app/fqkline/get");
    url.searchParams.set(
      "param",
      `${symbol},day,,${requestedEnd},${HISTORY_PAGE_SIZE},qfq`,
    );
    const response = await fetch(url, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`行情服务返回 ${response.status}`);
    return parseTencentCandles(await response.json(), symbol);
  };
  const candlesByDate = new Map<string, Candle>();
  const windowEnds: string[] = [];
  const cursor = new Date(`${endDate}T00:00:00Z`);
  while (cursor.toISOString().slice(0, 10) >= CN_MARKET_START) {
    windowEnds.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCFullYear(cursor.getUTCFullYear() - HISTORY_WINDOW_YEARS);
  }
  for (
    let offset = 0;
    offset < windowEnds.length;
    offset += HISTORY_FETCH_CONCURRENCY
  ) {
    const pages = await Promise.all(
      windowEnds
        .slice(offset, offset + HISTORY_FETCH_CONCURRENCY)
        .map(fetchCandles),
    );
    pages.flat().forEach((candle) => candlesByDate.set(candle.date, candle));
  }
  const candles = [...candlesByDate.values()];
  candles.sort((a, b) => a.date.localeCompare(b.date));
  const fullStock = {
    code: entry.code,
    name: entry.name,
    market: EXCHANGE_LABELS[entry.exchange],
    assetClass: "cn",
    candles,
  } satisfies StockSample;
  return prepareGameStock(fullStock, seed, scenario, difficulty);
}

async function cnBundle(
  key: string,
  date: string,
  scenario: ScenarioKind = "random",
  difficulty: ScenarioDifficulty = "standard",
) {
  const seed = hashText(`mangpan-${GAME_VERSION}-cn-${key}`);
  for (let attempt = 0; attempt < 8; attempt++) {
    const index =
      ((seed + Math.imul(attempt, 2654435761)) >>> 0) %
      CN_STOCK_UNIVERSE.length;
    try {
      const stock = await loadCnStock(
        CN_STOCK_UNIVERSE[index],
        date,
        seed + attempt,
        scenario,
        difficulty,
      );
      if (stock)
        return {
          date,
          market: "cn",
          stock,
          universeSize: CN_STOCK_UNIVERSE.length,
          dataSource: "live-universe",
        } satisfies ChallengeBundle;
    } catch {
      break;
    }
  }
  return {
    date,
    market: "cn",
    stock: await bundledStock(seed, "cn", scenario, difficulty),
    universeSize: CN_STOCK_UNIVERSE.length,
    dataSource: "embedded-fallback",
  } satisfies ChallengeBundle;
}

export async function getChallengeBundle(
  date: string,
  market: MarketKind = "cn",
) {
  if (market === "cn") return cnBundle(date, date);
  const seed = hashText(`mangpan-${GAME_VERSION}-${market}-${date}`);
  return {
    date,
    market,
    stock: await bundledStock(seed, market),
    universeSize: MARKET_UNIVERSE_SIZE.us,
    dataSource: "embedded-fallback",
  } satisfies ChallengeBundle;
}

export async function getPracticeBundle(
  seedText: string,
  market: MarketKind = "cn",
  scenario: ScenarioKind = "random",
  difficulty: ScenarioDifficulty = "standard",
) {
  const seed = hashText(`practice-${GAME_VERSION}-${market}-${seedText}`);
  if (market === "cn")
    return cnBundle(
      `practice-${scenario}-${difficulty}-${seedText}`,
      marketDate("cn"),
      scenario,
      difficulty,
    );
  return {
    date: "practice",
    market,
    stock: await bundledStock(seed, market, scenario, difficulty),
    universeSize: MARKET_UNIVERSE_SIZE.us,
    dataSource: "embedded-fallback",
  } satisfies ChallengeBundle;
}

export const MARKET_COUNTS = {
  ...MARKET_UNIVERSE_SIZE,
} as const;
export const REQUIRED_CANDLES = MIN_GAME_BARS;
