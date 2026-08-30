export type Candle = {
  date: string;
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
};

export type StockSample = {
  code: string;
  name: string;
  market: string;
  assetClass: "cn" | "us";
  candles: Candle[];
  initialVisibleCount?: number;
};

export const MARKET_UNIVERSE_SIZE = { cn: 5_550, us: 10 } as const;
