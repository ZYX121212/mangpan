import { and, eq } from "drizzle-orm";
import { getDb } from "../db";
import { duelChallenges } from "../db/schema";
import { GAME_VERSION, type MarketKind } from "./game-core";

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

type PendingDuelRoomInput = {
  playerId: string;
  date: string;
  market: MarketKind;
  challengeId: string;
  nickname: string;
};

type DuelResult = {
  nickname: string;
  score: number;
  returnRate: number;
  excess: number;
  maxDrawdown: number;
};

export function validDuelChallengeId(
  challengeId: string,
  date: string,
  market: MarketKind,
) {
  return (
    challengeId === `${date}@${GAME_VERSION}@${market}` ||
    challengeId.startsWith(`practice@${GAME_VERSION}@${market}@`)
  );
}

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

export async function createPendingDuelRoom({
  playerId,
  date,
  market,
  challengeId,
  nickname,
}: PendingDuelRoomInput) {
  let room = await findPlayerDuelRoom(playerId, challengeId);
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
        targetScore: -1,
      })
      .onConflictDoNothing();
    room = await findPlayerDuelRoom(playerId, challengeId);
  }
  if (!room) throw new Error("挑战房间创建失败");
  return room;
}

export async function completePendingDuelRoom(
  code: string,
  playerId: string,
  result: DuelResult,
) {
  await getDb()
    .update(duelChallenges)
    .set({
      challengerNickname: result.nickname,
      targetScore: result.score,
      targetReturnRate: result.returnRate,
      targetExcess: result.excess,
      targetMaxDrawdown: result.maxDrawdown,
    })
    .where(
      and(
        eq(duelChallenges.code, code),
        eq(duelChallenges.challengerPlayerId, playerId),
        eq(duelChallenges.targetScore, -1),
      ),
    );
  const [room] = await getDb()
    .select()
    .from(duelChallenges)
    .where(
      and(
        eq(duelChallenges.code, code),
        eq(duelChallenges.challengerPlayerId, playerId),
      ),
    )
    .limit(1);
  if (!room || room.targetScore < 0) throw new Error("挑战成绩锁定失败");
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
