export type DecisionStyleKey =
  | "independent-reader"
  | "calibrated-reader"
  | "risk-architect"
  | "patient-observer"
  | "conviction-tester"
  | "adaptive-analyst";

export type DecisionStyleInput = {
  calibration: number;
  risk: number;
  discipline: number;
  accuracy: number;
  confidentMisses: number;
  trades: number;
  peakExposure: number;
  contrarianCalls: number;
  contrarianWins: number;
};

export type DecisionStyle = {
  key: DecisionStyleKey;
  badge: string;
  title: string;
  description: string;
  nextGoal: string;
};

export function decisionStyleFor(
  input: DecisionStyleInput,
  locale: "en" | "zh" = "en",
): DecisionStyle {
  const t = (en: string, zh: string) => (locale === "zh" ? zh : en);
  if (
    input.contrarianCalls >= 2 &&
    input.contrarianWins / input.contrarianCalls >= 0.5
  ) {
    return {
      key: "independent-reader",
      badge: "IND",
      title: t("Independent Reader", "独立判断者"),
      description: t(
        `You challenged the crowd and earned it on ${input.contrarianWins} of ${input.contrarianCalls} calls.`,
        `你没有机械跟随人群，并在 ${input.contrarianCalls} 次逆向判断中命中 ${input.contrarianWins} 次。`,
      ),
      nextGoal: t(
        "Next run: separate genuine evidence from the urge to be different.",
        "下一局：继续区分真实独立证据与单纯为了反向而反向。",
      ),
    };
  }
  if (input.calibration >= 75 && input.confidentMisses === 0) {
    return {
      key: "calibrated-reader",
      badge: "CAL",
      title: t("Calibrated Reader", "校准型读盘者"),
      description: t(
        "Your confidence stayed close to what the chart actually delivered.",
        "你的信心水平与行情实际结果保持了良好匹配。",
      ),
      nextGoal: t(
        "Next run: keep the same probability discipline in a different regime.",
        "下一局：换一种行情环境，继续保持同样的概率纪律。",
      ),
    };
  }
  if (
    input.trades > 0 &&
    input.risk >= 80 &&
    input.discipline >= 80 &&
    input.peakExposure <= 75
  ) {
    return {
      key: "risk-architect",
      badge: "RSK",
      title: t("Risk Architect", "风险架构师"),
      description: t(
        "You protected capital without abandoning the decision process.",
        "你在持续做出判断的同时，为错误保留了足够的资金容错。",
      ),
      nextGoal: t(
        "Next run: preserve the risk budget while testing one stronger signal.",
        "下一局：维持风险预算，同时检验一个更明确的信号。",
      ),
    };
  }
  if (input.trades === 0) {
    return {
      key: "patient-observer",
      badge: "WAIT",
      title: t("Patient Observer", "耐心观察者"),
      description: t(
        "You treated no trade as a real decision, not an empty turn.",
        "你把不交易视为一个真实决策，而不是空过回合。",
      ),
      nextGoal: t(
        "Next run: define the exact evidence that would justify a small test position.",
        "下一局：明确什么证据足以支持一次小仓试探。",
      ),
    };
  }
  if (input.peakExposure >= 80 || input.trades >= 4) {
    return {
      key: "conviction-tester",
      badge: "TEST",
      title: t("Conviction Tester", "信念检验者"),
      description: t(
        "You acted decisively; the next edge is sizing conviction, not amplifying it.",
        "你愿意果断行动；下一步优势来自校准信念仓位，而不是继续放大它。",
      ),
      nextGoal: t(
        "Next run: begin at half the size and add only after fresh evidence.",
        "下一局：先用一半仓位，只有出现新证据时才继续增加风险。",
      ),
    };
  }
  return {
    key: "adaptive-analyst",
    badge: "ADAPT",
    title: t("Adaptive Analyst", "自适应分析者"),
    description: t(
      input.accuracy >= 60
        ? "You changed with the evidence and kept most calls aligned with reality."
        : "You changed with the evidence instead of forcing one market story.",
      input.accuracy >= 60
        ? "你能跟随证据调整，并让多数判断与实际行情保持一致。"
        : "你愿意跟随证据调整，而不是强行维持同一个市场故事。",
    ),
    nextGoal: t(
      "Next run: name one signal that changed your mind and test it again.",
      "下一局：明确一个真正改变你观点的信号，并再次检验它。",
    ),
  };
}
