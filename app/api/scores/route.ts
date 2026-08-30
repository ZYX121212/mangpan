import { and, asc, count, desc, eq, gt, like, lt, or } from "drizzle-orm";
import { ensureDatabase, getD1Database, getDb } from "../../../db";
import {
  dailyScores,
  duelChallenges,
  duelResponses,
  players,
  weeklyRewards,
} from "../../../db/schema";
import {
  getSessionForScore,
  getTrainingProfile,
} from "../../challenge-sessions";
import {
  GAME_VERSION,
  marketDate,
  replayChallenge,
  type MarketKind,
} from "../../game-core";
import {
  requestDisplayName,
  requestPlayerId,
  validPlayerId,
} from "../../request-identity";
import { calculateStreakProtection } from "../../streak-protection";
import {
  normalizeShareSource,
  type ShareSource,
} from "../../share-links";

type ScoreRow = typeof dailyScores.$inferSelect;

type DuelRoom = {
  isHost: boolean;
  responseCount: number;
  bestNickname: string | null;
  bestScore: number | null;
  sources: { source: ShareSource; count: number }[];
};

type ScoreSummary = {
  nickname: string;
  score: number;
  returnRate: number;
  excess: number;
  maxDrawdown: number;
  rank: number;
  percentile: number;
};

type DuelResponseRow = typeof duelResponses.$inferSelect;

function duelResponseSummary(
  row: DuelResponseRow,
  rank: number,
  total: number,
): ScoreSummary {
  return {
    nickname: row.nickname,
    score: row.score,
    returnRate: row.returnRate,
    excess: row.excess,
    maxDrawdown: row.maxDrawdown,
    rank,
    percentile:
      total <= 1 ? 100 : Math.round(((total - rank) / (total - 1)) * 100),
  };
}

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
  activity_days: number;
  contract_games: number;
  risk_controlled: number;
  position: number;
};

type AchievementInput = {
  completedDays: number;
  bestScore: number;
  benchmarkWins: number;
  riskControlled: number;
  recognitionCorrect: number;
  masteredCourses: number;
  duelCreated: number;
};

function buildAchievements(input: AchievementInput) {
  const definitions = [
    ["first_finish", "首次结算", "完成第 1 局正式挑战", input.completedDays, 1, 30],
    ["seven_days", "稳定打卡", "累计完成 7 局正式挑战", input.completedDays, 7, 80],
    ["benchmark_10", "基准猎手", "累计 10 局跑赢同期股票", input.benchmarkWins, 10, 120],
    ["score_85", "高分操盘手", "单局操盘评分达到 85", input.bestScore, 85, 120],
    ["risk_5", "回撤守门员", "5 局有交易且最大回撤不超过 5%", input.riskControlled, 5, 100],
    ["quiz_20", "形态观察家", "累计识别正确 20 道形态", input.recognitionCorrect, 20, 100],
    ["course_4", "课程探索者", "掌握 4 个训练课目", input.masteredCourses, 4, 100],
    ["course_12", "全情景大师", "掌握全部 12 个训练课目", input.masteredCourses, 12, 200],
    ["duel_host", "同图擂主", "收到 1 位好友的有效同图应战", input.duelCreated, 1, 60],
    ["thirty_days", "长期主义", "累计完成 30 局正式挑战", input.completedDays, 30, 150],
  ] as const;
  return definitions.map(([key, title, description, rawProgress, target, rewardXp], index) => {
    const progress = Math.max(0, Number(rawProgress));
    return {
      key,
      badge: String(index + 1).padStart(2, "0"),
      title,
      description,
      progress: Math.min(target, progress),
      target,
      rewardXp,
      unlocked: progress >= target,
    };
  });
}

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
    SELECT player_id, score, return_rate, excess, max_drawdown, trades, action_path, created_at,
      ROW_NUMBER() OVER (
        PARTITION BY player_id
        ORDER BY score DESC, created_at ASC
      ) AS day_rank
    FROM daily_scores INDEXED BY daily_scores_leaderboard_idx
    WHERE challenge_date >= ? AND challenge_date < ? AND challenge_date LIKE ?
  ), activity AS (
    SELECT player_id,
      COUNT(*) AS activity_days,
      SUM(CASE WHEN json_array_length(action_path) >= 3
        AND json_type(action_path, '$[0].probabilities') = 'object'
        THEN 1 ELSE 0 END) AS contract_games,
      SUM(CASE WHEN max_drawdown >= -5 AND trades > 0 THEN 1 ELSE 0 END) AS risk_controlled
    FROM eligible
    GROUP BY player_id
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
    SELECT weekly.*, activity.activity_days, activity.contract_games,
      activity.risk_controlled,
      RANK() OVER (
        ORDER BY points DESC, completed_days DESC, average_excess DESC, weekly.player_id ASC
      ) AS position
    FROM weekly JOIN activity ON activity.player_id = weekly.player_id
  )`;
  const columns = `SELECT ranked.player_id, players.nickname, ranked.points,
    ranked.completed_days, ranked.average_score, ranked.average_return,
    ranked.average_excess, ranked.activity_days, ranked.contract_games,
    ranked.risk_controlled, ranked.position
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
  const games = Math.min(3, Number(player?.activity_days || 0));
  const contractGames = Math.min(2, Number(player?.contract_games || 0));
  const riskControlled = Math.min(1, Number(player?.risk_controlled || 0));
  const completed =
    Number(games >= 3) +
    Number(contractGames >= 2) +
    Number(riskControlled >= 1);
  if (playerId && completed === 3) {
    await getDb()
      .insert(weeklyRewards)
      .values({
        id: `${playerId}:${market}:${range.start}`,
        playerId,
        market,
        weekStart: range.start,
        rewardXp: 120,
      })
      .onConflictDoNothing({
        target: [
          weeklyRewards.playerId,
          weeklyRewards.market,
          weeklyRewards.weekStart,
        ],
      });
  }
  const [currentReward, lifetimeReward] = playerId
    ? await Promise.all([
        getD1Database()
          .prepare(
            "SELECT reward_xp FROM weekly_rewards WHERE player_id = ? AND market = ? AND week_start = ? LIMIT 1",
          )
          .bind(playerId, market, range.start)
          .first<{ reward_xp: number }>(),
        getD1Database()
          .prepare(
            "SELECT COALESCE(SUM(reward_xp), 0) AS xp FROM weekly_rewards WHERE player_id = ? AND market = ?",
          )
          .bind(playerId, market)
          .first<{ xp: number }>(),
      ])
    : [null, null];
  return {
    start: range.start,
    end: range.end,
    rule: "每周取最佳 5 局，先比总分，再比完成天数与平均超额收益",
    total: Number(totalRow?.total || 0),
    leaderboard: (topResult.results as WeeklyRow[]).map(format),
    player: player ? format(player) : null,
    mission: {
      games,
      contractGames,
      riskControlled,
      completed,
      rewardXp: Number(currentReward?.reward_xp || 0),
    },
    lifetimeRewardXp: Number(lifetimeReward?.xp || 0),
  };
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
  duelRoom?: DuelRoom | null,
  playerOverride?: ScoreSummary | null,
  opponentOverride?: ScoreSummary | null,
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

  const [rankedPlayerScore, rankedOpponent] = await Promise.all([
    rankFor(playerId),
    opponentId && opponentId !== playerId
      ? rankFor(opponentId)
      : Promise.resolve(null),
  ]);
  const playerScore = rankedPlayerScore ?? playerOverride ?? null;
  const opponent = rankedOpponent ?? opponentOverride ?? null;
  const weekly = await buildWeeklyLeague(
    marketDate(market),
    market,
    playerId,
  );
  let stats = null;
  if (playerId) {
    type CareerRow = {
      completed_days: number;
      score_sum: number;
      average_score: number;
      best_score: number;
      benchmark_wins: number;
      risk_controlled: number;
      total_trades: number;
      best_return: number;
    };
    const suffix = `%@${GAME_VERSION}@${market}`;
    const [history, career, training, duelSummary, streakHistory] =
      await Promise.all([
        db
          .select()
          .from(dailyScores)
          .where(
            and(
              eq(dailyScores.playerId, playerId),
              like(dailyScores.challengeDate, suffix),
            ),
          )
          .orderBy(desc(dailyScores.challengeDate))
          .limit(120),
        getD1Database()
          .prepare(`SELECT COUNT(*) AS completed_days,
          COALESCE(SUM(score), 0) AS score_sum,
          COALESCE(ROUND(AVG(score)), 0) AS average_score,
          COALESCE(MAX(score), 0) AS best_score,
          COALESCE(SUM(CASE WHEN excess > 0 THEN 1 ELSE 0 END), 0) AS benchmark_wins,
          COALESCE(SUM(CASE WHEN max_drawdown >= -5 AND trades > 0 THEN 1 ELSE 0 END), 0) AS risk_controlled,
          COALESCE(SUM(trades), 0) AS total_trades,
          COALESCE(MAX(return_rate), 0) AS best_return
          FROM daily_scores INDEXED BY daily_scores_player_history_idx
          WHERE player_id = ? AND challenge_date LIKE ?`)
          .bind(playerId, suffix)
          .first<CareerRow>(),
        getTrainingProfile(playerId, market),
        getD1Database()
          .prepare(
            `SELECT COUNT(DISTINCT duel_challenges.code) AS total
            FROM duel_challenges
            INNER JOIN duel_responses ON duel_responses.duel_code = duel_challenges.code
            WHERE duel_challenges.challenger_player_id = ? AND duel_challenges.market = ?`,
          )
          .bind(playerId, market)
          .first<{ total: number }>(),
        getD1Database()
          .prepare(
            `SELECT challenge_date FROM daily_scores INDEXED BY daily_scores_player_history_idx
          WHERE player_id = ? AND challenge_date LIKE ? ORDER BY challenge_date ASC`,
          )
          .bind(playerId, suffix)
          .all<{ challenge_date: string }>(),
      ]);
    const completedDays = Number(career?.completed_days || 0);
    const averageScore = Number(career?.average_score || 0);
    const bestScore = Number(career?.best_score || 0);
    const benchmarkWins = Number(career?.benchmark_wins || 0);
    const riskControlled = Number(career?.risk_controlled || 0);
    const duelCreated = Number(duelSummary?.total || 0);
    const streakProtection = calculateStreakProtection(
      streakHistory.results.map((row) => row.challenge_date.split("@")[0]),
      marketDate(market),
    );
    const achievements = buildAchievements({
      completedDays,
      bestScore,
      benchmarkWins,
      riskControlled,
      recognitionCorrect: training.recognition.correct,
      masteredCourses: training.mastered,
      duelCreated,
    });
    const achievementXp = achievements
      .filter((achievement) => achievement.unlocked)
      .reduce((sum, achievement) => sum + achievement.rewardXp, 0);
    const xp =
      Number(career?.score_sum || 0) +
      training.missionXp +
      weekly.lifetimeRewardXp +
      achievementXp;
    stats = {
      completedDays,
      streak: streakProtection.streak,
      streakProtection,
      averageScore,
      bestScore,
      xp,
      level: Math.floor(xp / 300) + 1,
      levelProgress: xp % 300,
      profile: weeklyProfile(history),
      training,
      achievements,
      unlockedAchievements: achievements.filter(
        (achievement) => achievement.unlocked,
      ).length,
      achievementXp,
      records: {
        benchmarkWins,
        riskControlled,
        totalTrades: Number(career?.total_trades || 0),
        bestReturn: Number(career?.best_return || 0),
        duelCreated,
      },
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
    duelCode: duelRoom ? duelCode ?? null : null,
    duelRoom: duelRoom ?? null,
    weekly,
    stats,
  };
}

async function resolveDuelContext(
  duelCode: string,
  date: string,
  market: MarketKind,
  playerId?: string,
) {
  const db = getDb();
  const [duel] = await db
    .select()
    .from(duelChallenges)
    .where(eq(duelChallenges.code, duelCode.toUpperCase()))
    .limit(1);
  if (!duel || duel.challengeDate !== date || duel.market !== market)
    return null;
  const [[{ total }], [best], sourceRows, [respondent]] = await Promise.all([
    db
      .select({ total: count() })
      .from(duelResponses)
      .where(eq(duelResponses.duelCode, duel.code)),
    db
      .select()
      .from(duelResponses)
      .where(eq(duelResponses.duelCode, duel.code))
      .orderBy(
        desc(duelResponses.score),
        asc(duelResponses.createdAt),
        asc(duelResponses.respondentPlayerId),
      )
      .limit(1),
    db
      .select({ source: duelResponses.source, total: count() })
      .from(duelResponses)
      .where(eq(duelResponses.duelCode, duel.code))
      .groupBy(duelResponses.source),
    playerId
      ? db
          .select()
          .from(duelResponses)
          .where(
            and(
              eq(duelResponses.duelCode, duel.code),
              eq(duelResponses.respondentPlayerId, playerId),
            ),
          )
          .limit(1)
      : Promise.resolve([] as DuelResponseRow[]),
  ]);
  const isHost = duel.challengerPlayerId === playerId;
  let respondentScore: ScoreSummary | null = null;
  if (respondent) {
    const [{ above }] = await db
      .select({ above: count() })
      .from(duelResponses)
      .where(
        and(
          eq(duelResponses.duelCode, duel.code),
          or(
            gt(duelResponses.score, respondent.score),
            and(
              eq(duelResponses.score, respondent.score),
              or(
                lt(duelResponses.createdAt, respondent.createdAt),
                and(
                  eq(duelResponses.createdAt, respondent.createdAt),
                  lt(
                    duelResponses.respondentPlayerId,
                    respondent.respondentPlayerId,
                  ),
                ),
              ),
            ),
          ),
        ),
      );
    respondentScore = duelResponseSummary(respondent, Number(above) + 1, total);
  }
  return {
    duel,
    opponentId: isHost
      ? best?.respondentPlayerId
      : duel.challengerPlayerId !== playerId
        ? duel.challengerPlayerId
        : undefined,
    playerOverride: respondentScore,
    opponentOverride:
      isHost && best ? duelResponseSummary(best, 1, total) : null,
    room: {
      isHost,
      responseCount: total,
      bestNickname: best?.nickname ?? null,
      bestScore: best?.score ?? null,
      sources: sourceRows
        .map((row) => ({
          source: normalizeShareSource(row.source),
          count: Number(row.total),
        }))
        .sort(
          (left, right) =>
            right.count - left.count || left.source.localeCompare(right.source),
        ),
    } satisfies DuelRoom,
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
    const duelContext = duelCode
      ? await resolveDuelContext(duelCode, date, market, playerId)
      : null;
    if (duelCode && !duelContext)
      return Response.json(
        { error: "挑战码已过期或不属于当前市场" },
        { status: 404 },
      );
    return Response.json(
      await buildScoreboard(
        date,
        market,
        playerId,
        duelContext?.opponentId,
        duelCode,
        duelContext?.room,
        duelContext?.playerOverride,
        duelContext?.opponentOverride,
      ),
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
      duelCode?: unknown;
      duelSource?: unknown;
    };
    if (!validMarket(payload.market))
      return Response.json({ error: "市场无效" }, { status: 400 });
    if (!validDate(typeof payload.date === "string" ? payload.date : null))
      return Response.json({ error: "挑战日期无效" }, { status: 400 });
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
    const duelCode =
      typeof payload.duelCode === "string" && payload.duelCode
        ? payload.duelCode.toUpperCase()
        : undefined;
    const duelSource = normalizeShareSource(payload.duelSource);
    if (duelCode && !/^[A-Z0-9]{8,12}$/.test(duelCode))
      return Response.json({ error: "挑战码无效" }, { status: 400 });
    let duelContext = duelCode
      ? await resolveDuelContext(duelCode, date, market, playerId)
      : null;
    if (duelCode && !duelContext)
      return Response.json({ error: "挑战码已过期" }, { status: 404 });
    const isCurrentChallenge = date === marketDate(market);
    if (!isCurrentChallenge && !duelContext)
      return Response.json(
        { error: "历史挑战仅可通过有效好友房间提交" },
        { status: 400 },
      );
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
    if (isCurrentChallenge)
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

    if (duelContext && duelContext.duel.challengerPlayerId !== playerId) {
      const [officialScore] = isCurrentChallenge
        ? await db
            .select({
              nickname: dailyScores.nickname,
              score: dailyScores.score,
              returnRate: dailyScores.returnRate,
              excess: dailyScores.excess,
              maxDrawdown: dailyScores.maxDrawdown,
            })
            .from(dailyScores)
            .where(
              and(
                eq(dailyScores.challengeDate, storageDate),
                eq(dailyScores.playerId, playerId),
              ),
            )
            .limit(1)
        : [{
            nickname,
            score: result.score,
            returnRate: result.returnRate,
            excess: result.excess,
            maxDrawdown: result.maxDrawdown,
          }];
      if (officialScore)
        await db
          .insert(duelResponses)
          .values({
            id: `${duelContext.duel.code}:${playerId}`,
            duelCode: duelContext.duel.code,
            respondentPlayerId: playerId,
            nickname: officialScore.nickname,
            score: officialScore.score,
            returnRate: officialScore.returnRate,
            excess: officialScore.excess,
            maxDrawdown: officialScore.maxDrawdown,
            source: duelSource,
          })
          .onConflictDoNothing({
            target: [
              duelResponses.duelCode,
              duelResponses.respondentPlayerId,
            ],
          });
      duelContext = await resolveDuelContext(
        duelContext.duel.code,
        date,
        market,
        playerId,
      );
    }

    return Response.json(
      await buildScoreboard(
        date,
        market,
        playerId,
        duelContext?.opponentId,
        duelCode,
        duelContext?.room,
        duelContext?.playerOverride,
        duelContext?.opponentOverride,
      ),
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "成绩提交失败" },
      { status: 500 },
    );
  }
}
