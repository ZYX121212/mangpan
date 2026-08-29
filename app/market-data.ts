import { CN_STOCK_UNIVERSE, type CnStockEntry } from "./cn-stock-universe";
import { GAME_VERSION, INITIAL_BARS, MIN_FUTURE_BARS, MIN_GAME_BARS, chinaDate, hashText, type MarketKind } from "./game-config";
import { STOCK_SAMPLES, type Candle, type StockSample } from "./stock-data";
import { US_STOCK_SAMPLES } from "./us-stock-data";

export type ChallengeBundle = { date: string; market: MarketKind; stock: StockSample; universeSize: number; dataSource: "live-universe" | "embedded-fallback" };

const EXCHANGE_LABELS = { sh: "上证", sz: "深证", bj: "北证" } as const;
const HISTORY_PAGE_SIZE = 640;

function openEndedWindow(stock: StockSample, seed: number, poolSize: number) {
  if (stock.candles.length < MIN_GAME_BARS) return null;
  const latestDecisionIndex = stock.candles.length - MIN_FUTURE_BARS;
  const decisionSpan = latestDecisionIndex - INITIAL_BARS + 1;
  const decisionIndex = INITIAL_BARS + (Math.floor(seed / Math.max(1, poolSize)) % decisionSpan);
  const start = decisionIndex - INITIAL_BARS;
  return { ...stock, candles: stock.candles.slice(start) } as StockSample;
}

function bundledStock(seed: number, market: MarketKind) {
  const pool = market === "cn" ? STOCK_SAMPLES : US_STOCK_SAMPLES;
  const stock = pool[seed % pool.length];
  return openEndedWindow(stock, seed, pool.length) ?? stock;
}

function parseTencentCandles(payload: unknown, symbol: string) {
  const root = payload as { data?: Record<string, { qfqday?: unknown[]; day?: unknown[] }> };
  const stock = root?.data?.[symbol];
  const rows = stock?.qfqday ?? stock?.day ?? [];
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row) => {
    if (!Array.isArray(row) || row.length < 6) return [];
    const [date, open, close, high, low, volume] = row;
    const candle: Candle = { date: String(date), open: Number(open), close: Number(close), high: Number(high), low: Number(low), volume: Number(volume) };
    return /^\d{4}-\d{2}-\d{2}$/.test(candle.date) && Object.values(candle).every((value) => typeof value === "string" || Number.isFinite(value)) ? [candle] : [];
  });
}

async function loadCnStock(entry: CnStockEntry, endDate: string, seed: number) {
  const symbol = `${entry.exchange}${entry.code}`;
  const end = new Date(`${endDate}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() - (seed % (16 * 365)));
  const historicalEnd = end.toISOString().slice(0, 10);
  const fetchCandles = async (requestedEnd: string) => {
    const url = new URL("https://web.ifzq.gtimg.cn/appstock/app/fqkline/get");
    url.searchParams.set("param", `${symbol},day,,${requestedEnd},${HISTORY_PAGE_SIZE},qfq`);
    const response = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`行情服务返回 ${response.status}`);
    return parseTencentCandles(await response.json(), symbol);
  };
  let candles = await fetchCandles(historicalEnd);
  if (candles.length < MIN_GAME_BARS && historicalEnd !== endDate) candles = await fetchCandles(endDate);
  candles.sort((a, b) => a.date.localeCompare(b.date));
  const fullStock = {
    code: entry.code,
    name: entry.name,
    market: EXCHANGE_LABELS[entry.exchange],
    assetClass: "cn",
    candles,
  } satisfies StockSample;
  return openEndedWindow(fullStock, seed, CN_STOCK_UNIVERSE.length);
}

async function cnBundle(key: string, date: string) {
  const seed = hashText(`mangpan-${GAME_VERSION}-cn-${key}`);
  for (let attempt = 0; attempt < 8; attempt++) {
    const index = ((seed + Math.imul(attempt, 2654435761)) >>> 0) % CN_STOCK_UNIVERSE.length;
    try {
      const stock = await loadCnStock(CN_STOCK_UNIVERSE[index], date, seed + attempt);
      if (stock) return { date, market: "cn", stock, universeSize: CN_STOCK_UNIVERSE.length, dataSource: "live-universe" } satisfies ChallengeBundle;
    } catch {
      break;
    }
  }
  return { date, market: "cn", stock: bundledStock(seed, "cn"), universeSize: CN_STOCK_UNIVERSE.length, dataSource: "embedded-fallback" } satisfies ChallengeBundle;
}

export async function getChallengeBundle(date: string, market: MarketKind = "cn") {
  if (market === "cn") return cnBundle(date, date);
  const seed = hashText(`mangpan-${GAME_VERSION}-${market}-${date}`);
  return { date, market, stock: bundledStock(seed, market), universeSize: US_STOCK_SAMPLES.length, dataSource: "embedded-fallback" } satisfies ChallengeBundle;
}

export async function getPracticeBundle(seedText: string, market: MarketKind = "cn") {
  const seed = hashText(`practice-${GAME_VERSION}-${market}-${seedText}`);
  if (market === "cn") return cnBundle(`practice-${seedText}`, chinaDate());
  return { date: "practice", market, stock: bundledStock(seed, market), universeSize: US_STOCK_SAMPLES.length, dataSource: "embedded-fallback" } satisfies ChallengeBundle;
}

export const MARKET_COUNTS = { cn: CN_STOCK_UNIVERSE.length, us: US_STOCK_SAMPLES.length } as const;
export const REQUIRED_CANDLES = MIN_GAME_BARS;
