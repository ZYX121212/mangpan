import { and, eq } from "drizzle-orm";
import { ensureDatabase, getD1Database, getDb } from "../db";
import {
  dailyProgress,
  gameSessions,
  patternQuizzes,
  trainingProgress,
} from "../db/schema";
import {
  createPracticeChallenge,
  getDailyChallengeBundle,
  getStoredChallengeBundle,
  snapshotId,
} from "./challenge-service";
import {
  DAILY_CHALLENGE_DECISIONS,
  MAX_ACTIONS,
  forecastForAction,
  hashText,
  initialBarsFor,
  isOrderAllocation,
  isProbabilityForecast,
  marketDate,
  type ConfidenceLevel,
  type DecisionThesis,
  type MarketKind,
  type MarketOutlook,
  type ReplayAction,
} from "./game-config";
import { evaluateScenarioPass, replayChallenge } from "./game-core";
import type {
  ChallengeBundle,
  ScenarioDifficulty,
  ScenarioKind,
} from "./market-data";
import type { Candle, StockSample } from "./stock-types";

export type GameMode = "daily" | "practice" | "sprint" | "endless";

function maxDecisionsFor(mode: GameMode | string) {
  if (mode === "daily") return DAILY_CHALLENGE_DECISIONS;
  if (mode === "sprint") return 3;
  return null;
}

function storedGameMode(mode: string): GameMode {
  return mode === "daily" || mode === "sprint" || mode === "endless"
    ? mode
    : "practice";
}
export type PublicChallengeSession = {
  sessionId: string;
  date: string;
  market: MarketKind;
  mode: GameMode;
  stock: StockSample;
  totalBars: number;
  remainingBars: number;
  decisionsUsed: number;
  maxDecisions: number | null;
  universeSize: number;
  dataSource: ChallengeBundle["dataSource"];
  scenario: ScenarioKind;
  difficulty: ScenarioDifficulty;
  actions: ReplayAction[];
  crowdForecasts?: CrowdForecast[];
  resumed?: boolean;
};

export type CrowdForecast = {
  round: number;
  sampleSize: number;
  up: number;
  range: number;
  down: number;
};

async function getCrowdForecasts(
  challengeId: string,
  rounds: number,
): Promise<CrowdForecast[]> {
  if (rounds <= 0) return [];
  const result = await getD1Database()
    .prepare(
      `SELECT actions FROM game_sessions
       WHERE challenge_id = ? AND mode = 'daily' AND actions != '[]'
       ORDER BY updated_at DESC LIMIT 500`,
    )
    .bind(challengeId)
    .all<{ actions: string }>();
  const totals = Array.from({ length: rounds }, () => ({
    up: 0,
    range: 0,
    down: 0,
    sampleSize: 0,
  }));
  for (const row of result.results) {
    let actions: ReplayAction[] = [];
    try {
      actions = JSON.parse(row.actions) as ReplayAction[];
    } catch {
      actions = [];
    }
    for (let index = 0; index < rounds; index++) {
      const action = actions[index];
      const forecast = action ? forecastForAction(action) : null;
      if (!forecast) continue;
      totals[index].up += forecast.up;
      totals[index].range += forecast.range;
      totals[index].down += forecast.down;
      totals[index].sampleSize++;
    }
  }
  return totals.flatMap((total, index) => {
    if (!total.sampleSize) return [];
    const average = (value: number) =>
      Math.round((value / total.sampleSize) * 10) / 10;
    return [{
      round: index + 1,
      sampleSize: total.sampleSize,
      up: average(total.up),
      range: average(total.range),
      down: average(total.down),
    }];
  });
}

const QUIZ_SCENARIOS = ["trend", "reversal", "crash", "volatile"] as const;
type QuizScenario = (typeof QUIZ_SCENARIOS)[number];

type DailyActivity = {
  advancedDays?: number;
  quizAttempts?: number;
  quizCorrect?: number;
  trainingCompletions?: number;
};

export type PublicPatternQuiz = {
  quizId: string;
  market: MarketKind;
  difficulty: ScenarioDifficulty;
  stock: StockSample;
  universeSize: number;
};

async function getDailyMission(playerId: string, market: MarketKind) {
  const date = marketDate(market);
  const [row] = await getDb()
    .select()
    .from(dailyProgress)
    .where(
      and(
        eq(dailyProgress.playerId, playerId),
        eq(dailyProgress.market, market),
        eq(dailyProgress.progressDate, date),
      ),
    )
    .limit(1);
  const value = row ?? {
    advancedDays: 0,
    quizAttempts: 0,
    quizCorrect: 0,
    trainingCompletions: 0,
    rewardXp: 0,
  };
  const tasks = {
    quiz: Math.min(1, value.quizAttempts),
    days: Math.min(15, value.advancedDays),
    training: Math.min(1, value.trainingCompletions),
  };
  return {
    date,
    ...tasks,
    quizCorrect: value.quizCorrect,
    rewardXp: value.rewardXp,
    completed: Number(tasks.quiz >= 1) + Number(tasks.days >= 15) + Number(tasks.training >= 1),
  };
}

async function recordDailyActivity(
  playerId: string,
  market: MarketKind,
  activity: DailyActivity,
) {
  const date = marketDate(market);
  const now = new Date().toISOString();
  const increments = {
    advancedDays: Math.max(0, Math.floor(activity.advancedDays || 0)),
    quizAttempts: Math.max(0, Math.floor(activity.quizAttempts || 0)),
    quizCorrect: Math.max(0, Math.floor(activity.quizCorrect || 0)),
    trainingCompletions: Math.max(
      0,
      Math.floor(activity.trainingCompletions || 0),
    ),
  };
  await getD1Database()
    .prepare(`INSERT INTO daily_progress (
      id, player_id, market, progress_date, advanced_days, quiz_attempts,
      quiz_correct, training_completions, reward_xp, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
    ON CONFLICT(player_id, market, progress_date) DO UPDATE SET
      advanced_days = daily_progress.advanced_days + excluded.advanced_days,
      quiz_attempts = daily_progress.quiz_attempts + excluded.quiz_attempts,
      quiz_correct = daily_progress.quiz_correct + excluded.quiz_correct,
      training_completions = daily_progress.training_completions + excluded.training_completions,
      reward_xp = CASE
        WHEN daily_progress.reward_xp > 0 THEN daily_progress.reward_xp
        WHEN daily_progress.advanced_days + excluded.advanced_days >= 15
          AND daily_progress.quiz_attempts + excluded.quiz_attempts >= 1
          AND daily_progress.training_completions + excluded.training_completions >= 1
        THEN 60 ELSE 0 END,
      updated_at = excluded.updated_at`)
    .bind(
      `${playerId}:${market}:${date}`,
      playerId,
      market,
      date,
      increments.advancedDays,
      increments.quizAttempts,
      increments.quizCorrect,
      increments.trainingCompletions,
      now,
    )
    .run();
  return getDailyMission(playerId, market);
}

type SessionRow = typeof gameSessions.$inferSelect;

const OUTLOOKS: MarketOutlook[] = ["up", "range", "down"];
const THESES: DecisionThesis[] = [
  "trend",
  "breakout",
  "reversal",
  "volume",
  "uncertain",
];
const CONFIDENCE: ConfidenceLevel[] = [1, 2, 3];
const DAILY_ALLOCATIONS = [0.25, 0.5, 1];

function maskCandle(candle: Candle, index: number): Candle {
  return { ...candle, date: `T${String(index + 1).padStart(5, "0")}` };
}

function publicStock(bundle: ChallengeBundle, visibleCount: number) {
  const initialVisibleCount = initialBarsFor(bundle.stock);
  return {
    code: "••••••",
    name: "盲盘标的",
    market: bundle.market === "cn" ? "A股" : "美股",
    assetClass: bundle.stock.assetClass,
    initialVisibleCount,
    candles: bundle.stock.candles.slice(0, visibleCount).map(maskCandle),
  } satisfies StockSample;
}

function parseActions(row: SessionRow) {
  try {
    const parsed = JSON.parse(row.actions) as unknown;
    return Array.isArray(parsed) ? (parsed as ReplayAction[]) : [];
  } catch {
    return [];
  }
}

function cleanAction(value: unknown): ReplayAction | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Partial<ReplayAction>;
  if (!(input.kind === "buy" || input.kind === "sell" || input.kind === "hold"))
    return null;
  const days =
    input.days && [1, 2, 3, 4, 5].includes(input.days) ? input.days : 3;
  const outlook =
    input.outlook && OUTLOOKS.includes(input.outlook)
      ? input.outlook
      : undefined;
  const thesis =
    input.thesis && THESES.includes(input.thesis) ? input.thesis : undefined;
  const confidence =
    input.confidence && CONFIDENCE.includes(input.confidence)
      ? input.confidence
      : undefined;
  const probabilities = isProbabilityForecast(input.probabilities)
    ? input.probabilities
    : undefined;
  const hasAnyView =
    input.outlook !== undefined ||
    input.thesis !== undefined ||
    input.confidence !== undefined ||
    input.probabilities !== undefined;
  if (input.probabilities !== undefined && !probabilities) return null;
  if (hasAnyView && (!outlook || !thesis || !confidence)) return null;
  const recordedView =
    outlook && thesis && confidence
      ? { outlook, thesis, confidence, ...(probabilities ? { probabilities } : {}) }
      : {};
  if (input.kind === "hold")
    return { kind: "hold", days, ...recordedView };
  const hasAllocation = input.allocation !== undefined;
  const hasQuantity = input.quantity !== undefined;
  if (hasAllocation === hasQuantity) return null;
  if (hasAllocation && !isOrderAllocation(input.allocation)) return null;
  if (
    hasQuantity &&
    !(
      typeof input.quantity === "number" &&
      Number.isInteger(input.quantity) &&
      input.quantity > 0 &&
      input.quantity <= 1_000_000
    )
  )
    return null;
  return {
    kind: input.kind,
    days,
    ...recordedView,
    ...(hasQuantity
      ? { quantity: input.quantity }
      : { allocation: input.allocation }),
  };
}

async function insertSession(
  challengeId: string,
  bundle: ChallengeBundle,
  mode: GameMode,
  scenario: ScenarioKind = "random",
  difficulty: ScenarioDifficulty = "standard",
  playerId?: string,
  challengeDate = bundle.date,
) {
  await ensureDatabase();
  const initialVisibleCount = initialBarsFor(bundle.stock);
  const id = crypto.randomUUID();
  await getDb().insert(gameSessions).values({
    id,
    challengeId,
    challengeDate,
    market: bundle.market,
    mode,
    scenario,
    difficulty,
    playerId,
    visibleCount: initialVisibleCount,
    actions: "[]",
  });
  return {
    sessionId: id,
    date: challengeDate,
    market: bundle.market,
    mode,
    stock: publicStock(bundle, initialVisibleCount),
    totalBars: bundle.stock.candles.length,
    remainingBars: bundle.stock.candles.length - initialVisibleCount,
    decisionsUsed: 0,
    maxDecisions: maxDecisionsFor(mode),
    universeSize: bundle.universeSize,
    dataSource: bundle.dataSource,
    scenario,
    difficulty,
    actions: [],
  } satisfies PublicChallengeSession;
}

export async function startDailySession(
  date: string,
  market: MarketKind,
  playerId?: string,
) {
  const bundle = await getDailyChallengeBundle(date, market);
  return insertSession(
    snapshotId(date, market),
    bundle,
    "daily",
    "random",
    "standard",
    playerId,
  );
}

export async function startDuelSession(
  challengeId: string,
  playerId?: string,
  challengeDate?: string,
) {
  const bundle = await getStoredChallengeBundle(challengeId);
  return insertSession(
    challengeId,
    bundle,
    "daily",
    "random",
    "standard",
    playerId,
    challengeDate,
  );
}

export async function startDuelHostSession(
  seed: string,
  market: MarketKind,
  playerId: string,
) {
  const challenge = await createPracticeChallenge(
    `duel-${seed}`,
    market,
    "random",
    "standard",
  );
  const session = await insertSession(
    challenge.id,
    challenge.bundle,
    "daily",
    "random",
    "standard",
    playerId,
    marketDate(market),
  );
  return { session, challengeId: challenge.id };
}

export async function startPracticeSession(
  seed: string,
  market: MarketKind,
  scenario: ScenarioKind = "random",
  difficulty: ScenarioDifficulty = "standard",
  playerId?: string,
  guided = false,
) {
  const challenge = await createPracticeChallenge(
    seed,
    market,
    scenario,
    difficulty,
    guided,
  );
  return insertSession(
    challenge.id,
    challenge.bundle,
    "practice",
    scenario,
    difficulty,
    playerId,
  );
}

export async function startSprintSession(
  seed: string,
  market: MarketKind,
  playerId?: string,
) {
  const challenge = await createPracticeChallenge(
    `sprint-${seed}`,
    market,
    "random",
    "standard",
  );
  return insertSession(
    challenge.id,
    challenge.bundle,
    "sprint",
    "random",
    "standard",
    playerId,
  );
}

export async function startEndlessSession(
  seed: string,
  market: MarketKind,
  playerId?: string,
) {
  const challenge = await createPracticeChallenge(
    `endless-${seed}`,
    market,
    "random",
    "standard",
  );
  return insertSession(
    challenge.id,
    challenge.bundle,
    "endless",
    "random",
    "standard",
    playerId,
  );
}

export async function startPatternQuiz(
  seed: string,
  market: MarketKind,
  difficulty: ScenarioDifficulty,
  playerId: string,
  focus?: QuizScenario,
) {
  const scenario =
    focus && QUIZ_SCENARIOS.includes(focus)
      ? focus
      : QUIZ_SCENARIOS[
          hashText(`${playerId}:${market}:${difficulty}:${seed}`) %
            QUIZ_SCENARIOS.length
        ];
  const challenge = await createPracticeChallenge(
    `quiz-${seed}`,
    market,
    scenario,
    difficulty,
  );
  await ensureDatabase();
  const id = crypto.randomUUID();
  await getDb().insert(patternQuizzes).values({
    id,
    challengeId: challenge.id,
    playerId,
    market,
    difficulty,
    correctScenario: scenario,
  });
  const visibleCount = initialBarsFor(challenge.bundle.stock);
  return {
    quizId: id,
    market,
    difficulty,
    stock: publicStock(challenge.bundle, visibleCount),
    universeSize: challenge.bundle.universeSize,
  } satisfies PublicPatternQuiz;
}

const quizExplanation: Record<QuizScenario, string> = {
  trend:
    "系统在中期涨跌幅与短期延续性同时突出的真实片段中抽取此题。重点观察高低点是否持续同向移动。",
  reversal:
    "系统检测到前期方向与随后一段走势明显反向。拐点通常先出现动能衰减，再由价格结构确认。",
  crash:
    "系统在短期跌幅与波动率同时显著的真实片段中抽取此题。先识别风险扩张，再考虑收益机会。",
  volatile:
    "系统检测到显著振幅，但方向延续性相对较弱。高波动并不等于明确趋势，仓位控制更重要。",
};

export async function answerPatternQuiz(
  id: string,
  playerId: string,
  answer: QuizScenario,
  confidence: ConfidenceLevel,
) {
  await ensureDatabase();
  const [quiz] = await getDb()
    .select()
    .from(patternQuizzes)
    .where(eq(patternQuizzes.id, id))
    .limit(1);
  if (!quiz || quiz.playerId !== playerId) throw new Error("识别题不存在");
  if (quiz.answerScenario) throw new Error("这道识别题已经作答");
  const actual = quiz.correctScenario as QuizScenario;
  if (!QUIZ_SCENARIOS.includes(answer)) throw new Error("识别答案无效");
  const correct = answer === actual;
  const updated = await getD1Database()
    .prepare(
      "UPDATE pattern_quizzes SET answer_scenario = ?, confidence = ?, correct = ?, answered_at = ? WHERE id = ? AND answer_scenario IS NULL",
    )
    .bind(answer, confidence, correct ? 1 : 0, new Date().toISOString(), id)
    .run();
  if (updated.meta.changes !== 1) throw new Error("请勿重复提交识别答案");
  await recordDailyActivity(playerId, quiz.market as MarketKind, {
    quizAttempts: 1,
    quizCorrect: correct ? 1 : 0,
  });
  const bundle = await getStoredChallengeBundle(quiz.challengeId);
  const initialVisibleCount = initialBarsFor(bundle.stock);
  return {
    correct,
    market: quiz.market as MarketKind,
    answer,
    actual,
    confidence,
    explanation: quizExplanation[actual],
    identity: {
      name: bundle.stock.name,
      code: bundle.stock.code,
      market: bundle.stock.market,
      from: bundle.stock.candles[0]?.date,
      to: bundle.stock.candles[initialVisibleCount - 1]?.date,
    },
  };
}

async function loadSession(id: string) {
  await ensureDatabase();
  const [session] = await getDb()
    .select()
    .from(gameSessions)
    .where(eq(gameSessions.id, id))
    .limit(1);
  if (!session) throw new Error("本局挑战不存在或已经过期");
  const bundle = await getStoredChallengeBundle(session.challengeId);
  return { session, bundle, actions: parseActions(session) };
}

async function claimSession(
  session: SessionRow,
  playerId: string | undefined,
) {
  if (!playerId) return;
  if (session.playerId && session.playerId !== playerId)
    throw new Error("该挑战属于另一位玩家");
  if (session.playerId) return;
  const claimed = await getD1Database()
    .prepare(
      "UPDATE game_sessions SET player_id = ?, updated_at = ? WHERE id = ? AND player_id IS NULL",
    )
    .bind(playerId, new Date().toISOString(), session.id)
    .run();
  if (claimed.meta.changes !== 1) throw new Error("挑战归属校验失败");
}

function sessionScenario(session: SessionRow): ScenarioKind {
  return session.scenario === "trend" ||
    session.scenario === "reversal" ||
    session.scenario === "crash" ||
    session.scenario === "volatile"
    ? session.scenario
    : "random";
}

function sessionDifficulty(session: SessionRow): ScenarioDifficulty {
  return session.difficulty === "starter" || session.difficulty === "expert"
    ? session.difficulty
    : "standard";
}

export async function resumeSession(id: string, playerId: string) {
  const { session, bundle, actions } = await loadSession(id);
  if (session.finished) throw new Error("这局训练已经结束");
  await claimSession(session, playerId);
  const crowdForecasts =
    session.mode === "daily"
      ? await getCrowdForecasts(session.challengeId, actions.length)
      : [];
  return {
    sessionId: session.id,
    date: session.challengeDate,
    market: session.market as MarketKind,
    mode: storedGameMode(session.mode),
    stock: publicStock(bundle, session.visibleCount),
    totalBars: bundle.stock.candles.length,
    remainingBars: bundle.stock.candles.length - session.visibleCount,
    decisionsUsed: actions.length,
    maxDecisions: maxDecisionsFor(session.mode),
    universeSize: bundle.universeSize,
    dataSource: bundle.dataSource,
    scenario: sessionScenario(session),
    difficulty: sessionDifficulty(session),
    actions,
    crowdForecasts,
    resumed: true,
  } satisfies PublicChallengeSession;
}

export async function resumeLatestSession(
  playerId: string,
  market: MarketKind,
) {
  await ensureDatabase();
  const latest = await getD1Database()
    .prepare(
      "SELECT id FROM game_sessions WHERE player_id = ? AND market = ? AND finished = 0 AND actions != '[]' ORDER BY updated_at DESC LIMIT 1",
    )
    .bind(playerId, market)
    .first<{ id: string }>();
  return latest?.id ? resumeSession(latest.id, playerId) : null;
}

export async function abandonSession(id: string, playerId?: string) {
  const { session } = await loadSession(id);
  await claimSession(session, playerId);
  if (session.finished) throw new Error("本局已经结束");
  const abandonedMode =
    session.mode === "daily"
      ? "abandoned_daily"
      : session.mode === "sprint"
        ? "abandoned_sprint"
        : session.mode === "endless"
          ? "abandoned_endless"
          : "abandoned_practice";
  const abandoned = await getD1Database()
    .prepare(
      "UPDATE game_sessions SET mode = ?, finished = 1, updated_at = ? WHERE id = ? AND finished = 0",
    )
    .bind(abandonedMode, new Date().toISOString(), id)
    .run();
  if (abandoned.meta.changes !== 1) throw new Error("本局已经结束");
  return { abandoned: true };
}

export async function advanceSession(
  id: string,
  value: unknown,
  playerId?: string,
) {
  const { session, bundle, actions } = await loadSession(id);
  await claimSession(session, playerId);
  if (session.finished) throw new Error("本局已经结束");
  const maxDecisions = maxDecisionsFor(session.mode);
  if (maxDecisions !== null && actions.length >= maxDecisions)
    throw new Error(
      session.mode === "sprint"
        ? "Quick Read 已完成，请揭晓结果"
        : "今日挑战已完成，请揭晓结果",
    );
  if (actions.length >= MAX_ACTIONS) throw new Error("决策次数超出上限");
  const action = cleanAction(value);
  if (!action) throw new Error("交易指令无效，请检查委托内容");
  if (session.mode === "daily" || session.mode === "sprint") {
    if (!action.outlook || !action.thesis || !action.confidence)
      throw new Error("每日挑战须先锁定方向与信心");
    if (
      action.kind !== "hold" &&
      (action.quantity !== undefined ||
        action.allocation === undefined ||
        !DAILY_ALLOCATIONS.includes(action.allocation))
    )
      throw new Error("每日挑战仅支持 25%、50% 或 100% 仓位");
  }
  const remaining = Math.max(
    0,
    bundle.stock.candles.length - session.visibleCount,
  );
  if (!remaining) throw new Error("已经到达该段历史终点");
  const requestedDays = maxDecisions !== null ? 3 : action.days || 3;
  const holdingDays = Math.min(requestedDays, remaining) as
    1 | 2 | 3 | 4 | 5;
  const savedAction = { ...action, days: holdingDays };
  const nextActions = [...actions, savedAction];
  const nextVisibleCount = session.visibleCount + holdingDays;
  const finished =
    nextVisibleCount >= bundle.stock.candles.length ||
    (maxDecisions !== null && nextActions.length >= maxDecisions);
  const updated = await getD1Database()
    .prepare(
      `UPDATE game_sessions SET visible_count = ?, actions = ?, finished = ?, updated_at = ? WHERE id = ? AND visible_count = ? AND finished = 0`,
    )
    .bind(
      nextVisibleCount,
      JSON.stringify(nextActions),
      finished ? 1 : 0,
      new Date().toISOString(),
      id,
      session.visibleCount,
    )
    .run();
  if (updated.meta.changes !== 1)
    throw new Error("检测到重复推进，请以最新行情继续决策");
  const activityPlayerId = playerId ?? session.playerId ?? undefined;
  const contributesToDailyMission =
    session.mode !== "daily" ||
    (session.challengeDate === marketDate(session.market as MarketKind) &&
      session.challengeId ===
        snapshotId(
          session.challengeDate,
          session.market as MarketKind,
        ));
  const dailyMission = activityPlayerId && contributesToDailyMission
    ? await recordDailyActivity(
        activityPlayerId,
        session.market as MarketKind,
        { advancedDays: holdingDays },
      )
    : null;
  const crowdForecast =
    session.mode === "daily"
      ? (await getCrowdForecasts(session.challengeId, nextActions.length)).at(-1) ?? null
      : null;
  return {
    candles: bundle.stock.candles
      .slice(session.visibleCount, nextVisibleCount)
      .map((candle, index) => maskCandle(candle, session.visibleCount + index)),
    remainingBars: bundle.stock.candles.length - nextVisibleCount,
    decisionsUsed: nextActions.length,
    maxDecisions: maxDecisionsFor(session.mode),
    finished,
    action: savedAction,
    dailyMission,
    crowdForecast,
  };
}

async function recordTrainingResult(
  session: SessionRow,
  bundle: ChallengeBundle,
  actions: ReplayAction[],
  playerId: string,
) {
  if (session.mode !== "practice") return null;
  if (!actions.length) return null;
  const scenario = sessionScenario(session);
  if (scenario === "random") return null;
  const difficulty = sessionDifficulty(session);
  const market = session.market as MarketKind;
  const result = replayChallenge(bundle.stock, actions, market);
  const passed = evaluateScenarioPass(scenario, difficulty, result);
  const process = result.processScores;
  const now = new Date().toISOString();
  const inserted = await getD1Database()
    .prepare(`INSERT OR IGNORE INTO training_results (
      id, player_id, market, scenario, difficulty, score, passed,
      return_rate, excess, max_drawdown, direction_accuracy,
      risk_score, calibration_score, execution_score, discipline_score,
      performance_score, advanced_days, trades, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(
      session.id,
      playerId,
      market,
      scenario,
      difficulty,
      result.score,
      passed ? 1 : 0,
      result.returnRate,
      result.excess,
      result.maxDrawdown,
      result.directionAccuracy,
      process.risk,
      process.calibration,
      process.execution,
      process.discipline,
      process.performance,
      result.advancedDays,
      result.trades,
      now,
    )
    .run();
  if (inserted.meta.changes === 1) {
    const progressId = `${playerId}:${market}:${scenario}:${difficulty}`;
    await getD1Database()
      .prepare(`INSERT INTO training_progress (
        id, player_id, market, scenario, difficulty, attempts, passes,
        best_score, last_score, total_days, updated_at
      ) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
      ON CONFLICT(player_id, market, scenario, difficulty) DO UPDATE SET
        attempts = attempts + 1,
        passes = passes + excluded.passes,
        best_score = MAX(best_score, excluded.best_score),
        last_score = excluded.last_score,
        total_days = total_days + excluded.total_days,
        updated_at = excluded.updated_at`)
      .bind(
        progressId,
        playerId,
        market,
        scenario,
        difficulty,
        passed ? 1 : 0,
        result.score,
        result.score,
        result.advancedDays,
        now,
      )
      .run();
    await recordDailyActivity(playerId, market, { trainingCompletions: 1 });
  }
  return { passed, score: result.score, scenario, difficulty };
}

export async function getTrainingProfile(
  playerId: string,
  market: MarketKind,
) {
  await ensureDatabase();
  const rows = await getDb()
    .select()
    .from(trainingProgress)
    .where(
      and(
        eq(trainingProgress.playerId, playerId),
        eq(trainingProgress.market, market),
      ),
    );
  type AbilityRow = {
    risk_score: number;
    calibration_score: number;
    execution_score: number;
    discipline_score: number;
    performance_score: number;
  };
  const recent = await getD1Database()
    .prepare(`SELECT risk_score, calibration_score, execution_score,
      discipline_score, performance_score
      FROM training_results
      WHERE player_id = ? AND market = ?
      ORDER BY created_at DESC LIMIT 20`)
    .bind(playerId, market)
    .all<AbilityRow>();
  const recentRows = recent.results as AbilityRow[];
  type QuizProfileRow = {
    attempts: number;
    correct_count: number;
    high_confidence_misses: number;
  };
  const quizProfile = await getD1Database()
    .prepare(`SELECT COUNT(*) AS attempts,
      COALESCE(SUM(CASE WHEN correct = 1 THEN 1 ELSE 0 END), 0) AS correct_count,
      COALESCE(SUM(CASE WHEN correct = 0 AND confidence = 3 THEN 1 ELSE 0 END), 0) AS high_confidence_misses
      FROM pattern_quizzes
      WHERE player_id = ? AND market = ? AND answer_scenario IS NOT NULL`)
    .bind(playerId, market)
    .first<QuizProfileRow>();
  const quizAttempts = Number(quizProfile?.attempts || 0);
  const quizCorrect = Number(quizProfile?.correct_count || 0);
  const weakestRecognition = await getD1Database()
    .prepare(`SELECT correct_scenario, COUNT(*) AS mistakes
      FROM pattern_quizzes
      WHERE player_id = ? AND market = ? AND correct = 0
      GROUP BY correct_scenario
      ORDER BY mistakes DESC, MAX(answered_at) DESC
      LIMIT 1`)
    .bind(playerId, market)
    .first<{ correct_scenario: string; mistakes: number }>();
  const missionReward = await getD1Database()
    .prepare(
      "SELECT COALESCE(SUM(reward_xp), 0) AS xp FROM daily_progress WHERE player_id = ? AND market = ?",
    )
    .bind(playerId, market)
    .first<{ xp: number }>();
  const daily = await getDailyMission(playerId, market);
  const average = (key: keyof AbilityRow) =>
    recentRows.length
      ? Math.round(
          recentRows.reduce(
            (sum: number, row: AbilityRow) => sum + Number(row[key]),
            0,
          ) / recentRows.length,
        )
      : 0;
  return {
    progress: Object.fromEntries(
      rows.map((row) => [
        `${row.scenario}:${row.difficulty}`,
        row.passes,
      ]),
    ),
    attempts: rows.reduce((sum, row) => sum + row.attempts, 0),
    passes: rows.reduce((sum, row) => sum + row.passes, 0),
    totalDays: rows.reduce((sum, row) => sum + row.totalDays, 0),
    bestScore: rows.length
      ? Math.max(...rows.map((row) => row.bestScore))
      : 0,
    mastered: rows.filter((row) => row.passes > 0).length,
    ability: {
      risk: average("risk_score"),
      calibration: average("calibration_score"),
      execution: average("execution_score"),
      discipline: average("discipline_score"),
      performance: average("performance_score"),
    },
    recognition: {
      attempts: quizAttempts,
      correct: quizCorrect,
      accuracy: quizAttempts ? Math.round((quizCorrect / quizAttempts) * 100) : 0,
      highConfidenceMisses: Number(quizProfile?.high_confidence_misses || 0),
      weakestScenario: QUIZ_SCENARIOS.includes(
        weakestRecognition?.correct_scenario as QuizScenario,
      )
        ? (weakestRecognition?.correct_scenario as QuizScenario)
        : null,
      mistakes: Number(weakestRecognition?.mistakes || 0),
    },
    daily,
    missionXp: Number(missionReward?.xp || 0),
  };
}

export async function revealSession(id: string, playerId?: string) {
  const { session, bundle, actions } = await loadSession(id);
  await claimSession(session, playerId);
  const maxDecisions = maxDecisionsFor(session.mode);
  if (maxDecisions !== null && actions.length < maxDecisions)
    throw new Error(
      session.mode === "sprint"
        ? "完成 3 次决策后即可揭晓 Quick Read"
        : "完成 5 次决策后即可揭晓今日挑战",
    );
  if (!session.finished) {
    await getDb()
      .update(gameSessions)
      .set({ finished: true, updatedAt: new Date().toISOString() })
      .where(eq(gameSessions.id, id));
  }
  const trainingResult = playerId
    ? await recordTrainingResult(session, bundle, actions, playerId)
    : null;
  const trainingProfile = playerId
    ? await getTrainingProfile(playerId, session.market as MarketKind)
    : null;
  return {
    stock: bundle.stock,
    actions,
    visibleCount: session.visibleCount,
    trainingResult,
    trainingProfile,
  };
}

export async function getSessionForScore(id: string, playerId: string) {
  const loaded = await loadSession(id);
  if (loaded.session.mode !== "daily" || !loaded.session.finished)
    throw new Error("仅已完成的今日挑战可以上榜");
  if (loaded.actions.length !== DAILY_CHALLENGE_DECISIONS)
    throw new Error("今日排行榜只接受完整的 5 次决策挑战");
  const abandonedToday = await getD1Database()
    .prepare(
      "SELECT 1 AS abandoned FROM game_sessions WHERE player_id = ? AND challenge_date = ? AND market = ? AND mode = 'abandoned_daily' LIMIT 1",
    )
    .bind(
      playerId,
      loaded.session.challengeDate,
      loaded.session.market,
    )
    .first<{ abandoned: number }>();
  if (abandonedToday) throw new Error("今日挑战已放弃，不能提交排行榜成绩");
  if (loaded.session.playerId && loaded.session.playerId !== playerId)
    throw new Error("该挑战已经绑定其他玩家");
  if (!loaded.session.playerId) {
    const claimed = await getD1Database()
      .prepare(
        "UPDATE game_sessions SET player_id = ?, updated_at = ? WHERE id = ? AND player_id IS NULL",
      )
      .bind(playerId, new Date().toISOString(), id)
      .run();
    if (claimed.meta.changes !== 1) throw new Error("挑战归属校验失败");
  }
  return loaded;
}
