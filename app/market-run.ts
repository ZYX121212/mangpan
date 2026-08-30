import type { MarketKind } from "./game-config";
import type { ScenarioDifficulty, ScenarioKind } from "./market-data";

export const MARKET_RUN_DECISIONS = 5;

export const MARKET_RUN_STAGES = [
  {
    key: "trend",
    title: { en: "Find the trend", zh: "识别趋势" },
    scenario: "trend",
    difficulty: "starter",
  },
  {
    key: "turn",
    title: { en: "Read the turn", zh: "判断拐点" },
    scenario: "reversal",
    difficulty: "starter",
  },
  {
    key: "noise",
    title: { en: "Control the noise", zh: "穿越波动" },
    scenario: "volatile",
    difficulty: "standard",
  },
  {
    key: "crash",
    title: { en: "Survive the break", zh: "急跌生存" },
    scenario: "crash",
    difficulty: "standard",
  },
  {
    key: "final",
    title: { en: "The blind final", zh: "终局盲测" },
    scenario: "random",
    difficulty: "expert",
  },
] as const satisfies readonly {
  key: string;
  title: { en: string; zh: string };
  scenario: ScenarioKind;
  difficulty: ScenarioDifficulty;
}[];

export type MarketRunProgress = {
  market: MarketKind;
  scores: number[];
  completedSessionIds: string[];
  startedAt: number;
};

export function marketRunStorageKey(market: MarketKind) {
  return `mangpan-market-run-${market}`;
}

export function marketRunSessionStorageKey(market: MarketKind) {
  return `mangpan-run-active-session-${market}`;
}

export function newMarketRunProgress(
  market: MarketKind,
  startedAt = Date.now(),
): MarketRunProgress {
  return { market, scores: [], completedSessionIds: [], startedAt };
}

export function parseMarketRunProgress(
  value: string | null,
  market: MarketKind,
): MarketRunProgress {
  if (!value) return newMarketRunProgress(market);
  try {
    const parsed = JSON.parse(value) as Partial<MarketRunProgress>;
    const scores = Array.isArray(parsed.scores)
      ? parsed.scores
          .filter((score) => typeof score === "number" && Number.isFinite(score))
          .slice(0, MARKET_RUN_STAGES.length)
          .map((score) => Math.max(0, Math.min(100, Math.round(score))))
      : [];
    const completedSessionIds = Array.isArray(parsed.completedSessionIds)
      ? parsed.completedSessionIds
          .filter((id): id is string => typeof id === "string" && id.length > 0)
          .slice(-MARKET_RUN_STAGES.length)
      : [];
    return {
      market,
      scores,
      completedSessionIds,
      startedAt:
        typeof parsed.startedAt === "number" && Number.isFinite(parsed.startedAt)
          ? parsed.startedAt
          : Date.now(),
    };
  } catch {
    return newMarketRunProgress(market);
  }
}

export function recordMarketRunStage(
  progress: MarketRunProgress,
  sessionId: string,
  score: number,
) {
  if (
    progress.completedSessionIds.includes(sessionId) ||
    progress.scores.length >= MARKET_RUN_STAGES.length
  )
    return progress;
  return {
    ...progress,
    scores: [...progress.scores, Math.max(0, Math.min(100, Math.round(score)))],
    completedSessionIds: [...progress.completedSessionIds, sessionId],
  };
}

export function marketRunTotal(scores: readonly number[]) {
  return scores.reduce((total, score) => total + score, 0);
}

export function marketRunGrade(scores: readonly number[]) {
  const average = scores.length ? marketRunTotal(scores) / scores.length : 0;
  if (average >= 85) return "S";
  if (average >= 72) return "A";
  if (average >= 58) return "B";
  return "C";
}
