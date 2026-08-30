import type { Candle } from "./stock-types";

export type AnalysisMarker = {
  index: number;
  type: "B" | "S";
  price: number;
  quantity: number;
};

type AnalysisInput = {
  candles: Candle[];
  markers: AnalysisMarker[];
  equityHistory: number[];
  exposureHistory: number[];
  advancedDays: number;
  returnRate: number;
  benchmark: number;
  excess: number;
  maxDrawdown: number;
};

export type TradeAnalysis = {
  title: string;
  summary: string;
  confidence: string;
  metrics: { label: string; value: string; note: string }[];
  dimensions: { label: string; grade: string; tone: "good" | "watch" | "neutral"; text: string }[];
  lessons: string[];
  trainingGoal: string;
};

const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
const signed = (value: number) => `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;

export function buildTradeAnalysis(input: AnalysisInput): TradeAnalysis {
  const { candles, markers, equityHistory, exposureHistory, advancedDays, returnRate, benchmark, excess, maxDrawdown } = input;
  const buys = markers.filter((marker) => marker.type === "B");
  const sells = markers.filter((marker) => marker.type === "S");
  let inventory = 0;
  let averageCost = 0;
  let averageEntryIndex = 0;
  const realized: { rate: number; days: number }[] = [];

  markers.forEach((marker) => {
    if (marker.type === "B") {
      const nextInventory = inventory + marker.quantity;
      if (nextInventory > 0) {
        averageCost = (averageCost * inventory + marker.price * marker.quantity) / nextInventory;
        averageEntryIndex = (averageEntryIndex * inventory + marker.index * marker.quantity) / nextInventory;
        inventory = nextInventory;
      }
      return;
    }
    const quantity = Math.min(inventory, marker.quantity);
    if (quantity > 0 && averageCost > 0) {
      realized.push({ rate: (marker.price / averageCost - 1) * 100, days: Math.max(0, marker.index - averageEntryIndex) });
      inventory -= quantity;
      if (inventory < 1e-7) { inventory = 0; averageCost = 0; averageEntryIndex = 0; }
    }
  });

  const followRate = (marker: AnalysisMarker) => {
    const future = candles[Math.min(candles.length - 1, marker.index + 5)];
    return future ? (future.close / marker.price - 1) * 100 : 0;
  };
  const buyFollow = average(buys.map(followRate));
  const sellAvoidance = average(sells.map((marker) => -followRate(marker)));
  const averageExposure = average(exposureHistory.slice(1));
  const timeInMarket = exposureHistory.length > 1
    ? exposureHistory.slice(1).filter((value) => value > 1).length / (exposureHistory.length - 1) * 100
    : 0;
  const tradeFrequency = markers.length / Math.max(1, advancedDays) * 20;
  const winRate = realized.length ? realized.filter((trade) => trade.rate > 0).length / realized.length * 100 : null;
  const holdingDays = realized.length ? average(realized.map((trade) => trade.days)) : null;
  const peakRecovery = Math.max(...equityHistory) > equityHistory.at(-1)! ? "仍未回到本局净值峰值" : "结束时处于本局净值峰值附近";

  let title = "均衡的波段决策者";
  if (!markers.length) title = "耐心的场外观察者";
  else if (benchmark < 0 && excess > 5) title = "下行保护型交易者";
  else if (excess > 5 && maxDrawdown > -8) title = "风险调整型趋势捕手";
  else if (tradeFrequency > 8) title = "高频确认型交易者";
  else if (averageExposure > 75 && maxDrawdown < -10) title = "高仓位进攻型交易者";
  else if (buyFollow > 2) title = "右侧趋势型交易者";

  const sampleScore = Math.min(1, advancedDays / 80) * .55 + Math.min(1, markers.length / 8) * .45;
  const confidence = sampleScore >= .75
    ? `画像置信度较高：覆盖 ${advancedDays} 个交易日、${markers.length} 个成交点。`
    : sampleScore >= .4
      ? `画像置信度中等：已覆盖 ${advancedDays} 个交易日，建议再完成 2–3 个不同市场阶段验证。`
      : `画像仅作初步参考：当前只有 ${advancedDays} 个交易日、${markers.length} 个成交点，样本仍偏少。`;

  const riskGrade = maxDrawdown > -5 ? "控制稳健" : maxDrawdown > -12 ? "波动可控" : "需要降波动";
  const timingGrade = !markers.length ? "尚未采样" : (buyFollow + sellAvoidance) / 2 > 1 ? "有效" : (buyFollow + sellAvoidance) / 2 > -1 ? "中性" : "有待校准";
  const disciplineGrade = tradeFrequency <= 5 ? "节奏克制" : tradeFrequency <= 8 ? "节奏适中" : "交易偏密";

  const riskLesson = maxDrawdown < -10
    ? `把单次建仓上限先降到 1/2；你的最大回撤为 ${maxDrawdown.toFixed(1)}%，先控制净值波动，再追求收益。`
    : `保留当前仓位纪律；本局最大回撤 ${maxDrawdown.toFixed(1)}%，${peakRecovery}。`;
  const timingLesson = !markers.length
    ? "下一局至少完成一组买入与卖出，否则只能分析空仓结果，无法判断你的择时质量。"
    : buyFollow < 0
      ? `买入后 5 日平均表现为 ${signed(buyFollow)}；尝试等收盘站稳 MA10，下一交易日再执行。`
      : sells.length && sellAvoidance < 0
        ? `卖出后 5 日股价平均仍上涨 ${Math.abs(sellAvoidance).toFixed(1)}%；可用 1/2 分批卖出替代一次清仓。`
        : `买点后 5 日平均 ${signed(buyFollow)}，当前入场节奏有效；下一局重点验证它能否跨行情重复。`;
  const disciplineLesson = tradeFrequency > 8
    ? `每 20 日约 ${tradeFrequency.toFixed(1)} 次成交，偏密；下一局给每次交易写下一个条件，并设 3 日冷静期。`
    : averageExposure > 75
      ? `平均仓位 ${averageExposure.toFixed(0)}%，容错较低；先用 1/4 试仓，趋势确认后再加到 1/2 或 3/4。`
      : `每 20 日约 ${tradeFrequency.toFixed(1)} 次成交，节奏不拥挤；继续避免为了“有操作”而操作。`;

  return {
    title,
    summary: markers.length
      ? `你用 ${averageExposure.toFixed(0)}% 的平均仓位取得 ${signed(returnRate)}，相对股票同期 ${signed(excess)}。优势主要来自${excess >= 0 ? "仓位与择时配合" : "仍待验证的交易节奏"}，下一步应把偶然结果变成可重复规则。`
      : `你全程保持空仓，最终收益为 ${signed(returnRate)}，相对股票同期 ${signed(excess)}。这能反映风险偏好，但还不足以判断买卖能力。`,
    confidence,
    metrics: [
      { label: "平均仓位", value: `${averageExposure.toFixed(0)}%`, note: `在场 ${timeInMarket.toFixed(0)}% 的时间` },
      { label: "交易频率", value: `${tradeFrequency.toFixed(1)} 次`, note: "每 20 个交易日" },
      { label: "已实现胜率", value: winRate == null ? "样本不足" : `${winRate.toFixed(0)}%`, note: `${realized.length} 次卖出检验` },
      { label: "平均持有", value: holdingDays == null ? "尚未平仓" : `${holdingDays.toFixed(1)} 日`, note: "按已完成交易计算" },
    ],
    dimensions: [
      { label: "收益结果", grade: excess >= 3 ? "跑赢基准" : excess > -3 ? "接近基准" : "落后基准", tone: excess >= 3 ? "good" : excess < -3 ? "watch" : "neutral", text: `组合 ${signed(returnRate)}，股票同期 ${signed(benchmark)}，超额收益 ${signed(excess)}。` },
      { label: "风险控制", grade: riskGrade, tone: maxDrawdown > -8 ? "good" : maxDrawdown < -12 ? "watch" : "neutral", text: `最大回撤 ${maxDrawdown.toFixed(1)}%，平均仓位 ${averageExposure.toFixed(0)}%；${peakRecovery}。` },
      { label: "择时执行", grade: timingGrade, tone: timingGrade === "有效" ? "good" : timingGrade === "有待校准" ? "watch" : "neutral", text: `买入后 5 日平均 ${signed(buyFollow)}；卖出后避免的 5 日涨跌为 ${signed(sellAvoidance)}。` },
      { label: "交易纪律", grade: disciplineGrade, tone: tradeFrequency <= 5 ? "good" : tradeFrequency > 8 ? "watch" : "neutral", text: `共 ${markers.length} 次成交，每 20 日约 ${tradeFrequency.toFixed(1)} 次，持仓时间占比 ${timeInMarket.toFixed(0)}%。` },
    ],
    lessons: [riskLesson, timingLesson, disciplineLesson],
    trainingGoal: maxDrawdown < -10
      ? "下一局目标：最大仓位不超过 50%，最大回撤控制在 8% 内。"
      : tradeFrequency > 8
        ? "下一局目标：交易频率减半，只执行同时满足趋势与仓位条件的信号。"
        : !markers.length
          ? "下一局目标：用 1/4 仓完成一组买入—持有—卖出，获得可分析的闭环样本。"
          : "下一局目标：沿用本局最有效的买入条件，并至少分两次建仓或退出，验证稳定性。",
  };
}
