import { and, eq } from "drizzle-orm";
import { getDb } from "../db";
import { duelChallenges } from "../db/schema";
import type { MarketKind } from "./game-core";

export type ShareDuelRoom = {
  code: string;
  parentCode: string | null;
  chainDepth: number;
};

type EnsureDuelRoomInput = {
  playerId: string;
  date: string;
  market: MarketKind;
  challengeId: string;
  nickname: string;
  score: number;
  returnRate: number;
  excess: number;
  maxDrawdown: number;
  parentCode?: string;
  parentDepth?: number;
};

export async function findPlayerDuelRoom(
  playerId: string,
  challengeId: string,
) {
  const [room] = await getDb()
    .select()
    .from(duelChallenges)
    .where(
      and(
        eq(duelChallenges.challengerPlayerId, playerId),
        eq(duelChallenges.challengeId, challengeId),
      ),
    )
    .limit(1);
  return room ?? null;
}

export async function ensureDuelRoom({
  playerId,
  date,
  market,
  challengeId,
  nickname,
  score,
  returnRate,
  excess,
  maxDrawdown,
  parentCode,
  parentDepth = -1,
}: EnsureDuelRoomInput) {
  let room = await findPlayerDuelRoom(playerId, challengeId);
  const chainDepth = parentCode
    ? Math.min(999, Math.max(0, parentDepth + 1))
    : 0;
  for (let attempt = 0; !room && attempt < 4; attempt++) {
    const code = crypto
      .randomUUID()
      .replaceAll("-", "")
      .slice(0, 10)
      .toUpperCase();
    await getDb()
      .insert(duelChallenges)
      .values({
        code,
        challengerPlayerId: playerId,
        challengeDate: date,
        market,
        challengeId,
        challengerNickname: nickname,
        targetScore: score,
        targetReturnRate: returnRate,
        targetExcess: excess,
        targetMaxDrawdown: maxDrawdown,
        parentCode: parentCode ?? null,
        chainDepth,
      })
      .onConflictDoNothing();
    room = await findPlayerDuelRoom(playerId, challengeId);
  }
  if (!room) throw new Error("挑战码创建失败");
  return room;
}

export function publicShareDuelRoom(
  room: typeof duelChallenges.$inferSelect,
): ShareDuelRoom {
  return {
    code: room.code,
    parentCode: room.parentCode,
    chainDepth: room.chainDepth,
  };
}
