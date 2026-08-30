import { and, eq } from "drizzle-orm";
import { ensureDatabase, getDb } from "../../../db";
import { dailyScores } from "../../../db/schema";
import { ensureDuelRoom } from "../../duel-service";
import { GAME_VERSION, marketDate, type MarketKind } from "../../game-core";
import { requestPlayerId } from "../../request-identity";

const headers = { "cache-control": "no-store" };

function validDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function validMarket(value: unknown): value is MarketKind {
  return value === "cn" || value === "us";
}

function scoreDate(date: string, market: MarketKind) {
  return `${date}@${GAME_VERSION}@${market}`;
}

export async function POST(request: Request) {
  try {
    await ensureDatabase();
    const payload = (await request.json()) as {
      date?: unknown;
      market?: unknown;
      playerId?: unknown;
    };
    if (!validMarket(payload.market))
      return Response.json(
        { error: "挑战市场无效" },
        { status: 400, headers },
      );
    if (
      !validDate(payload.date) ||
      payload.date !== marketDate(payload.market)
    )
      return Response.json(
        { error: "仅可为今日正式成绩创建挑战" },
        { status: 400, headers },
      );
    const playerId = await requestPlayerId(request, payload.playerId);
    if (!playerId)
      return Response.json(
        { error: "玩家标识无效" },
        { status: 400, headers },
      );

    const challengeId = scoreDate(payload.date, payload.market);
    const [score] = await getDb()
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
          eq(dailyScores.challengeDate, scoreDate(payload.date, payload.market)),
          eq(dailyScores.playerId, playerId),
        ),
      )
      .limit(1);
    if (!score)
      return Response.json(
        { error: "完成并提交今日挑战后才可发起同图对决" },
        { status: 409, headers },
      );

    const duel = await ensureDuelRoom({
      playerId,
      date: payload.date,
      market: payload.market,
      challengeId,
      nickname: score.nickname,
      score: score.score,
      returnRate: score.returnRate,
      excess: score.excess,
      maxDrawdown: score.maxDrawdown,
    });
    return Response.json(
      {
        code: duel.code,
        date: duel.challengeDate,
        market: duel.market,
        challengerNickname: score.nickname,
      },
      { headers },
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "挑战码创建失败" },
      { status: 500, headers },
    );
  }
}
