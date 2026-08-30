import type { Candle, StockSample } from "./stock-types";

export type IntradayInterval = "5m" | "15m";

export type IntradayQuery = {
  symbol: string;
  market: "cn" | "us";
  interval: IntradayInterval;
  start: string;
  end: string;
};

export interface LicensedIntradayProvider {
  id: string;
  attribution: string;
  loadCandles(query: IntradayQuery): Promise<Candle[]>;
}

export async function buildIntradayStock(
  provider: LicensedIntradayProvider,
  query: IntradayQuery,
  identity: Omit<StockSample, "candles">,
) {
  const candles = await provider.loadCandles(query);
  if (candles.length < 240)
    throw new Error("分钟行情不足，无法形成公平的盲盘片段");
  for (let index = 1; index < candles.length; index++) {
    if (candles[index].date <= candles[index - 1].date)
      throw new Error("分钟行情时间序列无效");
  }
  return { ...identity, candles } satisfies StockSample;
}

// Intentionally no free/public scraper fallback: minute模式必须由已授权、可追溯的数据源注入。
