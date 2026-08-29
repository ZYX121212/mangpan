import { eq } from "drizzle-orm";
import { ensureDatabase, getD1Database, getDb } from "../db";
import { gameSessions } from "../db/schema";
import {
  createPracticeChallenge,
  getDailyChallengeBundle,
  getStoredChallengeBundle,
  snapshotId,
} from "./challenge-service";
import {
  MAX_ACTIONS,
  initialBarsFor,
  isOrderAllocation,
  type ConfidenceLevel,
  type DecisionThesis,
  type MarketKind,
  type MarketOutlook,
  type ReplayAction,
} from "./game-config";
import type {
  ChallengeBundle,
  ScenarioDifficulty,
  ScenarioKind,
} from "./market-data";
import type { Candle, StockSample } from "./stock-data";

export type GameMode = "daily" | "practice";
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
};

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
  if (!outlook || !thesis || !confidence) return null;
  if (input.kind === "hold")
    return { kind: "hold", days, outlook, thesis, confidence };
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
    outlook,
    thesis,
    confidence,
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
) {
  await ensureDatabase();
  const initialVisibleCount = initialBarsFor(bundle.stock);
  const id = crypto.randomUUID();
  await getDb().insert(gameSessions).values({
    id,
    challengeId,
    challengeDate: bundle.date,
    market: bundle.market,
    mode,
    visibleCount: initialVisibleCount,
    actions: "[]",
  });
  return {
    sessionId: id,
    date: bundle.date,
    market: bundle.market,
    mode,
    stock: publicStock(bundle, initialVisibleCount),
    totalBars: bundle.stock.candles.length,
    remainingBars: bundle.stock.candles.length - initialVisibleCount,
    decisionsUsed: 0,
    maxDecisions: null,
    universeSize: bundle.universeSize,
    dataSource: bundle.dataSource,
    scenario,
    difficulty,
  } satisfies PublicChallengeSession;
}

export async function startDailySession(date: string, market: MarketKind) {
  const bundle = await getDailyChallengeBundle(date, market);
  return insertSession(snapshotId(date, market), bundle, "daily");
}

export async function startPracticeSession(
  seed: string,
  market: MarketKind,
  scenario: ScenarioKind = "random",
  difficulty: ScenarioDifficulty = "standard",
) {
  const challenge = await createPracticeChallenge(
    seed,
    market,
    scenario,
    difficulty,
  );
  return insertSession(
    challenge.id,
    challenge.bundle,
    "practice",
    scenario,
    difficulty,
  );
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

export async function advanceSession(id: string, value: unknown) {
  const { session, bundle, actions } = await loadSession(id);
  if (session.finished) throw new Error("本局已经结束");
  if (actions.length >= MAX_ACTIONS) throw new Error("决策次数超出上限");
  const action = cleanAction(value);
  if (!action) throw new Error("请完整记录方向、依据和信心");
  const remaining = Math.max(
    0,
    bundle.stock.candles.length - session.visibleCount,
  );
  if (!remaining) throw new Error("已经到达该段历史终点");
  const holdingDays = Math.min(action.days || 3, remaining) as
    1 | 2 | 3 | 4 | 5;
  const savedAction = { ...action, days: holdingDays };
  const nextActions = [...actions, savedAction];
  const nextVisibleCount = session.visibleCount + holdingDays;
  const finished = nextVisibleCount >= bundle.stock.candles.length;
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
  return {
    candles: bundle.stock.candles
      .slice(session.visibleCount, nextVisibleCount)
      .map((candle, index) => maskCandle(candle, session.visibleCount + index)),
    remainingBars: bundle.stock.candles.length - nextVisibleCount,
    decisionsUsed: nextActions.length,
    maxDecisions: null,
    finished,
    action: savedAction,
  };
}

export async function revealSession(id: string) {
  const { session, bundle, actions } = await loadSession(id);
  if (!session.finished) {
    await getDb()
      .update(gameSessions)
      .set({ finished: true, updatedAt: new Date().toISOString() })
      .where(eq(gameSessions.id, id));
  }
  return { stock: bundle.stock, actions, visibleCount: session.visibleCount };
}

export async function getSessionForScore(id: string, playerId: string) {
  const loaded = await loadSession(id);
  if (loaded.session.mode !== "daily" || !loaded.session.finished)
    throw new Error("仅已完成的今日挑战可以上榜");
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
