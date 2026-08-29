import { and, asc, count, desc, eq, gt, like, lt, or } from "drizzle-orm";
import { ensureDatabase, getDb } from "../../../db";
import { dailyScores, players } from "../../../db/schema";
import { GAME_VERSION, MAX_ACTIONS, chinaDate, replayChallenge, type MarketKind, type ReplayAction } from "../../game-core";

type ScoreRow = typeof dailyScores.$inferSelect;

function scoreDate(date: string, market: MarketKind) {
  return `${date}@${GAME_VERSION}@${market}`;
}

function validMarket(value: unknown): value is MarketKind {
  return value === "cn" || value === "us";
}

function validDate(value: string | null): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function validPlayerId(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{10,80}$/.test(value);
}

function cleanNickname(value: unknown, playerId: string) {
  const fallback = `盲盘客${playerId.slice(-4).toUpperCase()}`;
  if (typeof value !== "string") return fallback;
  const cleaned = [...value].filter((character) => {
    const code = character.charCodeAt(0);
    return character !== "<" && character !== ">" && code >= 32 && code !== 127;
  }).join("").trim().slice(0, 12);
  return cleaned || fallback;
}

function validActions(value: unknown): value is ReplayAction[] {
  if (!Array.isArray(value) || value.length > MAX_ACTIONS) return false;
  return value.every((item) => {
    if (!item || typeof item !== "object") return false;
    const action = item as Partial<ReplayAction>;
    if (!(["buy", "sell", "hold"] as const).includes(action.kind as ReplayAction["kind"])) return false;
    if (action.days !== undefined && ![1, 2, 3, 4, 5].includes(action.days)) return false;
    if (action.kind === "hold") return true;
    return action.allocation === 0.25 || action.allocation === 0.5 || action.allocation === 1;
  });
}

function previousDate(date: string) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() - 1);
  return value.toISOString().slice(0, 10);
}

function calculateStreak(dates: string[], today: string) {
  const uniqueDates = [...new Set(dates)].sort().reverse();
  if (!uniqueDates.length) return 0;
  const yesterday = previousDate(today);
  if (uniqueDates[0] !== today && uniqueDates[0] !== yesterday) return 0;
  let expected = uniqueDates[0];
  let streak = 0;
  for (const date of uniqueDates) {
    if (date !== expected) break;
    streak++;
    expected = previousDate(expected);
  }
  return streak;
}

function weeklyProfile(rows: ScoreRow[]) {
  if (!rows.length) return { title: "等待第一局", text: "完成今日盲盘后，这里会开始记录你的长期决策风格。" };
  const recent = rows.slice(0, 7);
  const avgScore = recent.reduce((sum, row) => sum + row.score, 0) / recent.length;
  const avgExcess = recent.reduce((sum, row) => sum + row.excess, 0) / recent.length;
  const avgDrawdown = recent.reduce((sum, row) => sum + row.maxDrawdown, 0) / recent.length;
  const avgTrades = recent.reduce((sum, row) => sum + row.trades, 0) / recent.length;
  if (avgScore >= 76 && avgExcess > 2) return { title: "稳定的超额猎手", text: "最近的选择兼顾了收益和回撤，并持续跑赢盲盘基准。" };
  if (avgTrades > 6) return { title: "高频试探型", text: "你习惯用更多交易确认判断。下一步可以减少低确信度出手。" };
  if (avgDrawdown < -10) return { title: "高波动进攻型", text: "你的仓位进攻性较强，收益路径也更颠簸，控制回撤会显著改善评分。" };
  if (avgTrades <= 3) return { title: "耐心观察型", text: "你更愿意等待清晰机会，少量但有选择的决策是你的主要特征。" };
  return { title: "均衡波段型", text: "你的交易频率与风险暴露比较均衡，继续积累样本才能看出稳定优势。" };
}

async function buildScoreboard(date: string, market: MarketKind, playerId?: string, opponentId?: string) {
  const db = getDb();
  const storageDate = scoreDate(date, market);
  const top = await db.select({
    playerId: dailyScores.playerId,
    nickname: dailyScores.nickname,
    score: dailyScores.score,
    returnRate: dailyScores.returnRate,
    createdAt: dailyScores.createdAt,
  }).from(dailyScores)
    .where(eq(dailyScores.challengeDate, storageDate))
    .orderBy(desc(dailyScores.score), asc(dailyScores.createdAt), asc(dailyScores.playerId))
    .limit(20);
  const [{ total }] = await db.select({ total: count() }).from(dailyScores).where(eq(dailyScores.challengeDate, storageDate));

  const rankFor = async (targetId?: string) => {
    if (!targetId) return null;
    const [score] = await db.select().from(dailyScores)
      .where(and(eq(dailyScores.challengeDate, storageDate), eq(dailyScores.playerId, targetId))).limit(1);
    if (!score) return null;
    const [{ above }] = await db.select({ above: count() }).from(dailyScores).where(and(
      eq(dailyScores.challengeDate, storageDate),
      or(
        gt(dailyScores.score, score.score),
        and(eq(dailyScores.score, score.score), or(
          lt(dailyScores.createdAt, score.createdAt),
          and(eq(dailyScores.createdAt, score.createdAt), lt(dailyScores.playerId, score.playerId)),
        )),
      ),
    ));
    const rank = above + 1;
    const percentile = total <= 1 ? 100 : Math.round(((total - rank) / (total - 1)) * 100);
    return {
      nickname: score.nickname,
      score: score.score,
      returnRate: score.returnRate,
      excess: score.excess,
      maxDrawdown: score.maxDrawdown,
      rank,
      percentile,
    };
  };

  const [playerScore, opponent] = await Promise.all([
    rankFor(playerId),
    opponentId && opponentId !== playerId ? rankFor(opponentId) : Promise.resolve(null),
  ]);
  let stats = null;
  if (playerId) {
    const history = await db.select().from(dailyScores)
      .where(and(eq(dailyScores.playerId, playerId), like(dailyScores.challengeDate, `%@${GAME_VERSION}@${market}`)))
      .orderBy(desc(dailyScores.challengeDate)).limit(60);
    const averageScore = history.length ? Math.round(history.reduce((sum, row) => sum + row.score, 0) / history.length) : 0;
    stats = {
      completedDays: history.length,
      streak: calculateStreak(history.map((row) => row.challengeDate.split("@")[0]), chinaDate()),
      averageScore,
      bestScore: history.length ? Math.max(...history.map((row) => row.score)) : 0,
      profile: weeklyProfile(history),
    };
  }

  return {
    date,
    total,
    leaderboard: top.map((row, index) => ({
      rank: index + 1,
      nickname: row.nickname,
      score: row.score,
      returnRate: row.returnRate,
      isPlayer: row.playerId === playerId,
    })),
    playerScore,
    opponent,
    stats,
  };
}

export async function GET(request: Request) {
  try {
    await ensureDatabase();
    const url = new URL(request.url);
    const date = url.searchParams.get("date");
    const market = url.searchParams.get("market");
    const playerId = url.searchParams.get("playerId") ?? undefined;
    const opponentId = url.searchParams.get("opponentId") ?? undefined;
    if (!validDate(date)) return Response.json({ error: "日期格式无效" }, { status: 400 });
    if (!validMarket(market)) return Response.json({ error: "市场无效" }, { status: 400 });
    if (playerId && !validPlayerId(playerId)) return Response.json({ error: "玩家标识无效" }, { status: 400 });
    if (opponentId && !validPlayerId(opponentId)) return Response.json({ error: "挑战者标识无效" }, { status: 400 });
    return Response.json(await buildScoreboard(date, market, playerId, opponentId));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "排行榜暂时不可用" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureDatabase();
    const payload = await request.json() as { date?: unknown; market?: unknown; playerId?: unknown; nickname?: unknown; actions?: unknown };
    if (!validDate(typeof payload.date === "string" ? payload.date : null) || payload.date !== chinaDate()) {
      return Response.json({ error: "仅可提交今日正式挑战" }, { status: 400 });
    }
    if (!validMarket(payload.market)) return Response.json({ error: "市场无效" }, { status: 400 });
    if (!validPlayerId(payload.playerId)) return Response.json({ error: "玩家标识无效" }, { status: 400 });
    if (!validActions(payload.actions)) return Response.json({ error: "决策路径无效" }, { status: 400 });

    const date = payload.date;
    const playerId = payload.playerId;
    const nickname = cleanNickname(payload.nickname, playerId);
    const market = payload.market;
    const result = replayChallenge(date, payload.actions, market);
    const storageDate = scoreDate(date, market);
    const db = getDb();
    await db.insert(players).values({ id: playerId, nickname })
      .onConflictDoUpdate({ target: players.id, set: { nickname, updatedAt: new Date().toISOString() } });
    await db.insert(dailyScores).values({
      id: `${storageDate}:${playerId}`,
      challengeDate: storageDate,
      playerId,
      nickname,
      score: result.score,
      returnRate: result.returnRate,
      benchmark: result.benchmark,
      excess: result.excess,
      maxDrawdown: result.maxDrawdown,
      trades: result.trades,
      rounds: result.rounds,
      actionPath: JSON.stringify(payload.actions),
    }).onConflictDoNothing({ target: [dailyScores.challengeDate, dailyScores.playerId] });

    return Response.json(await buildScoreboard(date, market, playerId));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "成绩提交失败" }, { status: 500 });
  }
}
