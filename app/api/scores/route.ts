import { and, asc, count, desc, eq, gt, like, lt, or } from "drizzle-orm";
import { ensureDatabase, getD1Database, getDb } from "../../../db";
import { dailyScores, duelChallenges, players } from "../../../db/schema";
import {
  getSessionForScore,
  getTrainingProfile,
} from "../../challenge-sessions";
import {
  GAME_VERSION,
  chinaDate,
  replayChallenge,
  type MarketKind,
} from "../../game-core";
import {
  requestDisplayName,
  requestPlayerId,
  validPlayerId,
} from "../../request-identity";

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

function cleanNickname(value: unknown, playerId: string) {
  const fallback = `盲盘客${playerId.slice(-4).toUpperCase()}`;
  if (typeof value !== "string") return fallback;
  const cleaned = [...value]
    .filter((character) => {
      const code = character.charCodeAt(0);
      return (
        character !== "<" && character !== ">" && code >= 32 && code !== 127
      );
    })
    .join("")
    .trim()
    .slice(0, 12);
  return cleaned || fallback;
}

function previousDate(date: string) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() - 1);
  return value.toISOString().slice(0, 10);
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function weekRange(date: string) {
  const value = new Date(`${date}T00:00:00Z`);
  const weekday = value.getUTCDay() || 7;
  const start = addDays(date, 1 - weekday);
  return { start, end: addDays(start, 6), next: addDays(start, 7) };
}

type WeeklyRow = {
  player_id: string;
  nickname: string;
  points: number;
  completed_days: number;
  average_score: number;
  average_return: number;
  average_excess: number;
  position: number;
};

async function buildWeeklyLeague(
  date: string,
  market: MarketKind,
  playerId?: string,
) {
  const range = weekRange(date);
  const params = [
    `${range.start}@`,
    `${range.next}@`,
    `%@${GAME_VERSION}@${market}`,
  ] as const;
  const cte = `WITH eligible AS (
    SELECT player_id, score, return_rate, excess, created_at,
      ROW_NUMBER() OVER (
        PARTITION BY player_id
        ORDER BY score DESC, created_at ASC
      ) AS day_rank
    FROM daily_scores INDEXED BY daily_scores_leaderboard_idx
    WHERE challenge_date >= ? AND challenge_date < ? AND challenge_date LIKE ?
  ), weekly AS (
    SELECT player_id,
      SUM(score) AS points,
      COUNT(*) AS completed_days,
      ROUND(AVG(score)) AS average_score,
      AVG(return_rate) AS average_return,
      AVG(excess) AS average_excess
    FROM eligible
    WHERE day_rank <= 5
    GROUP BY player_id
  ), ranked AS (
    SELECT weekly.*,
      RANK() OVER (
        ORDER BY points DESC, completed_days DESC, average_excess DESC, player_id ASC
      ) AS position
    FROM weekly
  )`;
  const columns = `SELECT ranked.player_id, players.nickname, ranked.points,
    ranked.completed_days, ranked.average_score, ranked.average_return,
    ranked.average_excess, ranked.position
    FROM ranked JOIN players ON players.id = ranked.player_id`;
  const database = getD1Database();
  const [topResult, player, totalRow] = await Promise.all([
    database
      .prepare(`${cte} ${columns} ORDER BY position ASC LIMIT 20`)
      .bind(...params)
      .all<WeeklyRow>(),
    playerId
      ? database
          .prepare(`${cte} ${columns} WHERE ranked.player_id = ? LIMIT 1`)
          .bind(...params, playerId)
          .first<WeeklyRow>()
      : Promise.resolve(null),
    database
      .prepare(`${cte} SELECT COUNT(*) AS total FROM ranked`)
      .bind(...params)
      .first<{ total: number }>(),
  ]);
  const format = (row: WeeklyRow) => ({
    rank: Number(row.position),
    nickname: row.nickname,
    points: Number(row.points),
    completedDays: Number(row.completed_days),
    averageScore: Number(row.average_score),
    averageReturn: Number(row.average_return),
    averageExcess: Number(row.average_excess),
    isPlayer: row.player_id === playerId,
  });
  return {
    start: range.start,
    end: range.end,
    rule: "每周取最佳 5 局，先比总分，再比完成天数与平均超额收益",
    total: Number(totalRow?.total || 0),
    leaderboard: (topResult.results as WeeklyRow[]).map(format),
    player: player ? format(player) : null,
  };
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
  if (!rows.length)
    return {
      title: "等待第一局",
      text: "完成今日盲盘后，这里会开始记录你的长期决策风格。",
    };
  const recent = rows.slice(0, 7);
  const avgScore =
    recent.reduce((sum, row) => sum + row.score, 0) / recent.length;
  const avgExcess =
    recent.reduce((sum, row) => sum + row.excess, 0) / recent.length;
  const avgDrawdown =
    recent.reduce((sum, row) => sum + row.maxDrawdown, 0) / recent.length;
  const avgTrades =
    recent.reduce((sum, row) => sum + row.trades, 0) / recent.length;
  if (avgScore >= 76 && avgExcess > 2)
    return {
      title: "稳定的超额猎手",
      text: "最近的选择兼顾了收益和回撤，并持续跑赢盲盘基准。",
    };
  if (avgTrades > 6)
    return {
      title: "高频试探型",
      text: "你习惯用更多交易确认判断。下一步可以减少低确信度出手。",
    };
  if (avgDrawdown < -10)
    return {
      title: "高波动进攻型",
      text: "你的仓位进攻性较强，收益路径也更颠簸，控制回撤会显著改善评分。",
    };
  if (avgTrades <= 3)
    return {
      title: "耐心观察型",
      text: "你更愿意等待清晰机会，少量但有选择的决策是你的主要特征。",
    };
  return {
    title: "均衡波段型",
    text: "你的交易频率与风险暴露比较均衡，继续积累样本才能看出稳定优势。",
  };
}

async function buildScoreboard(
  date: string,
  market: MarketKind,
  playerId?: string,
  opponentId?: string,
  duelCode?: string,
) {
  const db = getDb();
  const storageDate = scoreDate(date, market);
  const top = await db
    .select({
      playerId: dailyScores.playerId,
      nickname: dailyScores.nickname,
      score: dailyScores.score,
      returnRate: dailyScores.returnRate,
      createdAt: dailyScores.createdAt,
    })
    .from(dailyScores)
    .where(eq(dailyScores.challengeDate, storageDate))
    .orderBy(
      desc(dailyScores.score),
      asc(dailyScores.createdAt),
      asc(dailyScores.playerId),
    )
    .limit(20);
  const [{ total }] = await db
    .select({ total: count() })
    .from(dailyScores)
    .where(eq(dailyScores.challengeDate, storageDate));

  const rankFor = async (targetId?: string) => {
    if (!targetId) return null;
    const [score] = await db
      .select()
      .from(dailyScores)
      .where(
        and(
          eq(dailyScores.challengeDate, storageDate),
          eq(dailyScores.playerId, targetId),
        ),
      )
      .limit(1);
    if (!score) return null;
    const [{ above }] = await db
      .select({ above: count() })
      .from(dailyScores)
      .where(
        and(
          eq(dailyScores.challengeDate, storageDate),
          or(
            gt(dailyScores.score, score.score),
            and(
              eq(dailyScores.score, score.score),
              or(
                lt(dailyScores.createdAt, score.createdAt),
                and(
                  eq(dailyScores.createdAt, score.createdAt),
                  lt(dailyScores.playerId, score.playerId),
                ),
              ),
            ),
          ),
        ),
      );
    const rank = above + 1;
    const percentile =
      total <= 1 ? 100 : Math.round(((total - rank) / (total - 1)) * 100);
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
    opponentId && opponentId !== playerId
      ? rankFor(opponentId)
      : Promise.resolve(null),
  ]);
  let stats = null;
  if (playerId) {
    const history = await db
      .select()
      .from(dailyScores)
      .where(
        and(
          eq(dailyScores.playerId, playerId),
          like(dailyScores.challengeDate, `%@${GAME_VERSION}@${market}`),
        ),
      )
      .orderBy(desc(dailyScores.challengeDate))
      .limit(60);
    const averageScore = history.length
      ? Math.round(
          history.reduce((sum, row) => sum + row.score, 0) / history.length,
        )
      : 0;
    const training = await getTrainingProfile(playerId, market);
    const xp =
      history.reduce((sum, row) => sum + row.score, 0) + training.missionXp;
    stats = {
      completedDays: history.length,
      streak: calculateStreak(
        history.map((row) => row.challengeDate.split("@")[0]),
        chinaDate(),
      ),
      averageScore,
      bestScore: history.length
        ? Math.max(...history.map((row) => row.score))
        : 0,
      xp,
      level: Math.floor(xp / 300) + 1,
      levelProgress: xp % 300,
      profile: weeklyProfile(history),
      training,
    };
  }

  const weekly = await buildWeeklyLeague(date, market, playerId);
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
    duelCode: opponentId ? duelCode ?? null : null,
    weekly,
    stats,
  };
}

export async function GET(request: Request) {
  try {
    await ensureDatabase();
    const url = new URL(request.url);
    const date = url.searchParams.get("date");
    const market = url.searchParams.get("market");
    const playerId = await requestPlayerId(
      request,
      url.searchParams.get("playerId"),
    );
    const duelCode = url.searchParams.get("duel") ?? undefined;
    if (!validDate(date))
      return Response.json({ error: "日期格式无效" }, { status: 400 });
    if (!validMarket(market))
      return Response.json({ error: "市场无效" }, { status: 400 });
    if (playerId && !validPlayerId(playerId))
      return Response.json({ error: "玩家标识无效" }, { status: 400 });
    if (duelCode && !/^[A-Z0-9]{8,12}$/i.test(duelCode))
      return Response.json({ error: "挑战码无效" }, { status: 400 });
    let opponentId: string | undefined;
    if (duelCode) {
      const [duel] = await getDb()
        .select()
        .from(duelChallenges)
        .where(eq(duelChallenges.code, duelCode.toUpperCase()))
        .limit(1);
      if (
        !duel ||
        duel.challengeDate !== date ||
        duel.market !== market
      )
        return Response.json(
          { error: "挑战码已过期或不属于当前市场" },
          { status: 404 },
        );
      if (duel.challengerPlayerId !== playerId)
        opponentId = duel.challengerPlayerId;
    }
    return Response.json(
      await buildScoreboard(date, market, playerId, opponentId, duelCode),
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "排行榜暂时不可用" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    await ensureDatabase();
    const payload = (await request.json()) as {
      date?: unknown;
      market?: unknown;
      playerId?: unknown;
      nickname?: unknown;
      sessionId?: unknown;
    };
    if (
      !validDate(typeof payload.date === "string" ? payload.date : null) ||
      payload.date !== chinaDate()
    ) {
      return Response.json({ error: "仅可提交今日正式挑战" }, { status: 400 });
    }
    if (!validMarket(payload.market))
      return Response.json({ error: "市场无效" }, { status: 400 });
    const resolvedPlayerId = await requestPlayerId(request, payload.playerId);
    if (!resolvedPlayerId)
      return Response.json({ error: "玩家标识无效" }, { status: 400 });
    if (
      typeof payload.sessionId !== "string" ||
      !/^[a-f0-9-]{30,40}$/i.test(payload.sessionId)
    )
      return Response.json({ error: "挑战会话无效" }, { status: 400 });

    const date = payload.date;
    const playerId = resolvedPlayerId;
    const nickname = cleanNickname(
      payload.nickname ?? requestDisplayName(request),
      playerId,
    );
    const market = payload.market;
    const challenge = await getSessionForScore(payload.sessionId, playerId);
    if (
      challenge.session.challengeDate !== date ||
      challenge.session.market !== market
    )
      return Response.json({ error: "挑战与榜单不匹配" }, { status: 400 });
    const result = replayChallenge(
      challenge.bundle.stock,
      challenge.actions,
      market,
    );
    const storageDate = scoreDate(date, market);
    const db = getDb();
    await db
      .insert(players)
      .values({ id: playerId, nickname })
      .onConflictDoUpdate({
        target: players.id,
        set: { nickname, updatedAt: new Date().toISOString() },
      });
    await db
      .insert(dailyScores)
      .values({
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
        actionPath: JSON.stringify(challenge.actions),
      })
      .onConflictDoNothing({
        target: [dailyScores.challengeDate, dailyScores.playerId],
      });

    return Response.json(await buildScoreboard(date, market, playerId));
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "成绩提交失败" },
      { status: 500 },
    );
  }
}
