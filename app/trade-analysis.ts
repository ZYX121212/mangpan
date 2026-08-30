import type { Candle } from "./stock-types";

export type AnalysisMarker = {
  index: number;
  type: "B" | "S";
  price: number;
  quantity: number;
};

type AnalysisInput = {
  locale: "zh" | "en";
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
  const { locale, candles, markers, equityHistory, exposureHistory, advancedDays, returnRate, benchmark, excess, maxDrawdown } = input;
  const t = (zh: string, en: string) => locale === "en" ? en : zh;
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
  const peakRecovery = Math.max(...equityHistory) > equityHistory.at(-1)!
    ? t("仍未回到本局净值峰值", "equity remains below its session peak")
    : t("结束时处于本局净值峰值附近", "the session ended near peak equity");

  let title = t("均衡的波段决策者", "Balanced Swing Trader");
  if (!markers.length) title = t("耐心的场外观察者", "Patient Observer");
  else if (benchmark < 0 && excess > 5) title = t("下行保护型交易者", "Downside Defender");
  else if (excess > 5 && maxDrawdown > -8) title = t("风险调整型趋势捕手", "Risk-adjusted Trend Reader");
  else if (tradeFrequency > 8) title = t("高频确认型交易者", "High-frequency Confirmer");
  else if (averageExposure > 75 && maxDrawdown < -10) title = t("高仓位进攻型交易者", "High-exposure Attacker");
  else if (buyFollow > 2) title = t("右侧趋势型交易者", "Confirmation Trend Trader");

  const sampleScore = Math.min(1, advancedDays / 80) * .55 + Math.min(1, markers.length / 8) * .45;
  const confidence = sampleScore >= .75
    ? t(
      `画像置信度较高：覆盖 ${advancedDays} 个交易日、${markers.length} 个成交点。`,
      `High-confidence profile: ${advancedDays} trading days and ${markers.length} execution points.`,
    )
    : sampleScore >= .4
      ? t(
        `画像置信度中等：已覆盖 ${advancedDays} 个交易日，建议再完成 2–3 个不同市场阶段验证。`,
        `Medium-confidence profile: ${advancedDays} trading days. Test it across 2–3 more market regimes.`,
      )
      : t(
        `画像仅作初步参考：当前只有 ${advancedDays} 个交易日、${markers.length} 个成交点，样本仍偏少。`,
        `Early read only: ${advancedDays} trading days and ${markers.length} execution points are not yet a stable sample.`,
      );

  const riskGrade = maxDrawdown > -5
    ? t("控制稳健", "Strong")
    : maxDrawdown > -12
      ? t("波动可控", "Controlled")
      : t("需要降波动", "Reduce Risk");
  const timingGrade = !markers.length
    ? t("尚未采样", "No Sample")
    : (buyFollow + sellAvoidance) / 2 > 1
      ? t("有效", "Effective")
      : (buyFollow + sellAvoidance) / 2 > -1
        ? t("中性", "Neutral")
        : t("有待校准", "Needs Calibration");
  const disciplineGrade = tradeFrequency <= 5
    ? t("节奏克制", "Measured")
    : tradeFrequency <= 8
      ? t("节奏适中", "Moderate")
      : t("交易偏密", "Too Frequent");

  const riskLesson = maxDrawdown < -10
    ? t(
      `把单次建仓上限先降到 1/2；你的最大回撤为 ${maxDrawdown.toFixed(1)}%，先控制净值波动，再追求收益。`,
      `Cap the next entry at 1/2 exposure. Your max drawdown was ${maxDrawdown.toFixed(1)}%; control equity volatility before chasing return.`,
    )
    : t(
      `保留当前仓位纪律；本局最大回撤 ${maxDrawdown.toFixed(1)}%，${peakRecovery}。`,
      `Keep the current sizing discipline. Max drawdown was ${maxDrawdown.toFixed(1)}%, and ${peakRecovery}.`,
    );
  const timingLesson = !markers.length
    ? t(
      "下一局至少完成一组买入与卖出，否则只能分析空仓结果，无法判断你的择时质量。",
      "Complete at least one buy-and-sell cycle next session; staying in cash alone cannot reveal execution quality.",
    )
    : buyFollow < 0
      ? t(
        `买入后 5 日平均表现为 ${signed(buyFollow)}；尝试等收盘站稳 MA10，下一交易日再执行。`,
        `Average five-day performance after buys was ${signed(buyFollow)}. Try waiting for a close above MA10 before executing next session.`,
      )
      : sells.length && sellAvoidance < 0
        ? t(
          `卖出后 5 日股价平均仍上涨 ${Math.abs(sellAvoidance).toFixed(1)}%；可用 1/2 分批卖出替代一次清仓。`,
          `Price rose another ${Math.abs(sellAvoidance).toFixed(1)}% on average in the five days after sells. Test a half-exit instead of closing all at once.`,
        )
        : t(
          `买点后 5 日平均 ${signed(buyFollow)}，当前入场节奏有效；下一局重点验证它能否跨行情重复。`,
          `Average five-day performance after buys was ${signed(buyFollow)}. The entry rhythm worked here; test whether it repeats in another regime.`,
        );
  const disciplineLesson = tradeFrequency > 8
    ? t(
      `每 20 日约 ${tradeFrequency.toFixed(1)} 次成交，偏密；下一局给每次交易写下一个条件，并设 3 日冷静期。`,
      `${tradeFrequency.toFixed(1)} trades per 20 days is crowded. Write one condition for every trade and require a three-day cooldown next session.`,
    )
    : averageExposure > 75
      ? t(
        `平均仓位 ${averageExposure.toFixed(0)}%，容错较低；先用 1/4 试仓，趋势确认后再加到 1/2 或 3/4。`,
        `Average exposure was ${averageExposure.toFixed(0)}%, leaving little room for error. Start at 1/4 and scale only after confirmation.`,
      )
      : t(
        `每 20 日约 ${tradeFrequency.toFixed(1)} 次成交，节奏不拥挤；继续避免为了“有操作”而操作。`,
        `${tradeFrequency.toFixed(1)} trades per 20 days is measured. Keep avoiding trades made only for the sake of activity.`,
      );

  return {
    title,
    summary: markers.length
      ? t(
        `你用 ${averageExposure.toFixed(0)}% 的平均仓位取得 ${signed(returnRate)}，相对股票同期 ${signed(excess)}。优势主要来自${excess >= 0 ? "仓位与择时配合" : "仍待验证的交易节奏"}，下一步应把偶然结果变成可重复规则。`,
        `You earned ${signed(returnRate)} with ${averageExposure.toFixed(0)}% average exposure, ${signed(excess)} versus the stock. ${excess >= 0 ? "Sizing and timing worked together" : "The trading rhythm still needs validation"}; turn the outcome into a repeatable rule.`,
      )
      : t(
        `你全程保持空仓，最终收益为 ${signed(returnRate)}，相对股票同期 ${signed(excess)}。这能反映风险偏好，但还不足以判断买卖能力。`,
        `You stayed in cash for the full session and returned ${signed(returnRate)}, ${signed(excess)} versus the stock. This reveals risk preference, not yet trading ability.`,
      ),
    confidence,
    metrics: [
      { label: t("平均仓位", "Average Exposure"), value: `${averageExposure.toFixed(0)}%`, note: t(`在场 ${timeInMarket.toFixed(0)}% 的时间`, `In market ${timeInMarket.toFixed(0)}% of the time`) },
      { label: t("交易频率", "Trade Frequency"), value: t(`${tradeFrequency.toFixed(1)} 次`, `${tradeFrequency.toFixed(1)} trades`), note: t("每 20 个交易日", "Per 20 trading days") },
      { label: t("已实现胜率", "Realized Win Rate"), value: winRate == null ? t("样本不足", "Not enough data") : `${winRate.toFixed(0)}%`, note: t(`${realized.length} 次卖出检验`, `${realized.length} sell checks`) },
      { label: t("平均持有", "Average Hold"), value: holdingDays == null ? t("尚未平仓", "No closed trade") : t(`${holdingDays.toFixed(1)} 日`, `${holdingDays.toFixed(1)} days`), note: t("按已完成交易计算", "Closed trades only") },
    ],
    dimensions: [
      { label: t("收益结果", "Return Outcome"), grade: excess >= 3 ? t("跑赢基准", "Beat Benchmark") : excess > -3 ? t("接近基准", "Near Benchmark") : t("落后基准", "Lagged Benchmark"), tone: excess >= 3 ? "good" : excess < -3 ? "watch" : "neutral", text: t(`组合 ${signed(returnRate)}，股票同期 ${signed(benchmark)}，超额收益 ${signed(excess)}。`, `Portfolio ${signed(returnRate)}, stock ${signed(benchmark)}, excess return ${signed(excess)}.`) },
      { label: t("风险控制", "Risk Control"), grade: riskGrade, tone: maxDrawdown > -8 ? "good" : maxDrawdown < -12 ? "watch" : "neutral", text: t(`最大回撤 ${maxDrawdown.toFixed(1)}%，平均仓位 ${averageExposure.toFixed(0)}%；${peakRecovery}。`, `Max drawdown ${maxDrawdown.toFixed(1)}%, average exposure ${averageExposure.toFixed(0)}%; ${peakRecovery}.`) },
      { label: t("择时执行", "Timing & Execution"), grade: timingGrade, tone: timingGrade === t("有效", "Effective") ? "good" : timingGrade === t("有待校准", "Needs Calibration") ? "watch" : "neutral", text: t(`买入后 5 日平均 ${signed(buyFollow)}；卖出后避免的 5 日涨跌为 ${signed(sellAvoidance)}。`, `Average five-day move after buys: ${signed(buyFollow)}; move avoided after sells: ${signed(sellAvoidance)}.`) },
      { label: t("交易纪律", "Trading Discipline"), grade: disciplineGrade, tone: tradeFrequency <= 5 ? "good" : tradeFrequency > 8 ? "watch" : "neutral", text: t(`共 ${markers.length} 次成交，每 20 日约 ${tradeFrequency.toFixed(1)} 次，持仓时间占比 ${timeInMarket.toFixed(0)}%。`, `${markers.length} executions, ${tradeFrequency.toFixed(1)} per 20 days, in-market ${timeInMarket.toFixed(0)}% of the time.`) },
    ],
    lessons: [riskLesson, timingLesson, disciplineLesson],
    trainingGoal: maxDrawdown < -10
      ? t("下一局目标：最大仓位不超过 50%，最大回撤控制在 8% 内。", "Next goal: cap exposure at 50% and keep max drawdown within 8%.")
      : tradeFrequency > 8
        ? t("下一局目标：交易频率减半，只执行同时满足趋势与仓位条件的信号。", "Next goal: halve trade frequency and act only when trend and sizing conditions both qualify.")
        : !markers.length
          ? t("下一局目标：用 1/4 仓完成一组买入—持有—卖出，获得可分析的闭环样本。", "Next goal: complete one 1/4-size buy–hold–sell cycle to create an analyzable sample.")
          : t("下一局目标：沿用本局最有效的买入条件，并至少分两次建仓或退出，验证稳定性。", "Next goal: reuse the most effective entry condition and scale in or out at least twice to test stability."),
  };
}
