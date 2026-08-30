import { cache } from "react";
import { and, eq } from "drizzle-orm";
import { ensureDatabase, getDb } from "../db";
import { dailyScores, duelChallenges } from "../db/schema";
import { GAME_VERSION, type MarketKind } from "./game-core";

export type PublicDuelInvite = {
  code: string;
  date: string;
  market: MarketKind;
  challengerNickname: string;
  targetScore: number;
};

function validCode(value: string) {
  return /^[A-Z0-9]{8,12}$/.test(value);
}

function scoreDate(date: string, market: MarketKind) {
  return `${date}@${GAME_VERSION}@${market}`;
}

export const getPublicDuelInvite = cache(
  async (rawCode: string): Promise<PublicDuelInvite | null> => {
    const code = rawCode.trim().toUpperCase();
    if (!validCode(code)) return null;
    await ensureDatabase();
    const db = getDb();
    const [duel] = await db
      .select()
      .from(duelChallenges)
      .where(eq(duelChallenges.code, code))
      .limit(1);
    if (!duel || (duel.market !== "cn" && duel.market !== "us")) return null;
    const market = duel.market;
    const [score] = await db
      .select({ nickname: dailyScores.nickname, score: dailyScores.score })
      .from(dailyScores)
      .where(
        and(
          eq(dailyScores.challengeDate, scoreDate(duel.challengeDate, market)),
          eq(dailyScores.playerId, duel.challengerPlayerId),
        ),
      )
      .limit(1);
    if (!score) return null;
    return {
      code,
      date: duel.challengeDate,
      market,
      challengerNickname: score.nickname,
      targetScore: score.score,
    };
  },
);
