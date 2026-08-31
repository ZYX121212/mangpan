export type CelebrationMilestone =
  | "first_chart"
  | "three_chart_sample"
  | "training_mastered"
  | "top_decile"
  | "duel_win"
  | "streak_guard"
  | "market_run_complete";

export type CelebrationContext = {
  isMarketRun: boolean;
  marketRunFinished: boolean;
  isDaily: boolean;
  dailySettled: boolean;
  dailyPercentile?: number | null;
  duelWon: boolean;
  streakGuardEarned: boolean;
  trainingMastered: boolean;
  sessionChartCount: number;
  guidedFirstChart: boolean;
};

/**
 * One result earns at most one emotional peak. More meaningful, rarer
 * achievements win over generic progress so the celebration stays credible.
 */
export function celebrationMilestone({
  isMarketRun,
  marketRunFinished,
  isDaily,
  dailySettled,
  dailyPercentile,
  duelWon,
  streakGuardEarned,
  trainingMastered,
  sessionChartCount,
  guidedFirstChart,
}: CelebrationContext): CelebrationMilestone | null {
  if (isMarketRun)
    return marketRunFinished ? "market_run_complete" : null;
  if (isDaily && !dailySettled) return null;
  if (streakGuardEarned) return "streak_guard";
  if (duelWon) return "duel_win";
  if (typeof dailyPercentile === "number" && dailyPercentile >= 90)
    return "top_decile";
  if (trainingMastered) return "training_mastered";
  if (sessionChartCount >= 3) return "three_chart_sample";
  if (guidedFirstChart) return "first_chart";
  return null;
}

export function isPlatformCelebration(
  milestone: CelebrationMilestone,
) {
  return milestone !== "first_chart";
}
