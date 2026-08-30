import { and, eq } from "drizzle-orm";
import { ensureDatabase, getDb } from "../../../db";
import { dailyScores, duelChallenges } from "../../../db/schema";
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

async function existingDuel(
  playerId: string,
  date: string,
  market: MarketKind,
) {
  const [row] = await getDb()
    .select()
    .from(duelChallenges)
    .where(
      and(
        eq(duelChallenges.challengerPlayerId, playerId),
        eq(duelChallenges.challengeDate, date),
        eq(duelChallenges.market, market),
      ),
    )
    .limit(1);
  return row ?? null;
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

    const [score] = await getDb()
      .select({ nickname: dailyScores.nickname })
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

    let duel = await existingDuel(playerId, payload.date, payload.market);
    for (let attempt = 0; !duel && attempt < 4; attempt++) {
      const code = crypto.randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase();
      await getDb()
        .insert(duelChallenges)
        .values({
          code,
          challengerPlayerId: playerId,
          challengeDate: payload.date,
          market: payload.market,
        })
        .onConflictDoNothing();
      duel = await existingDuel(playerId, payload.date, payload.market);
    }
    if (!duel) throw new Error("挑战码创建失败");
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
