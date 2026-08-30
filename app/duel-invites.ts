import { cache } from "react";
import { count, eq } from "drizzle-orm";
import { ensureDatabase, getDb } from "../db";
import { duelChallenges, duelResponses } from "../db/schema";
import type { MarketKind } from "./game-core";

export type PublicDuelInvite = {
  code: string;
  date: string;
  market: MarketKind;
  challengeId: string;
  challengerNickname: string;
  targetScore: number;
  responseCount: number;
};

function validCode(value: string) {
  return /^[A-Z0-9]{8,12}$/.test(value);
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
    if (
      !duel.challengeId.startsWith(`${duel.challengeDate}@`) ||
      !duel.challengeId.endsWith(`@${market}`) ||
      !duel.challengerNickname.trim() ||
      duel.targetScore < 0 ||
      duel.targetScore > 100
    )
      return null;
    const [{ responseCount }] = await db
      .select({ responseCount: count() })
      .from(duelResponses)
      .where(eq(duelResponses.duelCode, duel.code));
    return {
      code,
      date: duel.challengeDate,
      market,
      challengeId: duel.challengeId,
      challengerNickname: duel.challengerNickname,
      targetScore: duel.targetScore,
      responseCount,
    };
  },
);
