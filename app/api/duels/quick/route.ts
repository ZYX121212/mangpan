import { ensureDatabase } from "../../../../db";
import { startDuelHostSession } from "../../../challenge-sessions";
import { createPendingDuelRoom } from "../../../duel-service";
import type { MarketKind } from "../../../game-config";
import {
  requestDisplayName,
  requestPlayerId,
} from "../../../request-identity";

const headers = { "cache-control": "no-store" };

function validMarket(value: unknown): value is MarketKind {
  return value === "cn" || value === "us";
}

function cleanNickname(value: unknown, playerId: string) {
  const fallback = `Reader-${playerId.slice(-4).toUpperCase()}`;
  if (typeof value !== "string") return fallback;
  const cleaned = [...value]
    .filter((character) => {
      const code = character.charCodeAt(0);
      return character !== "<" && character !== ">" && code >= 32 && code !== 127;
    })
    .join("")
    .trim()
    .slice(0, 12);
  return cleaned || fallback;
}

export async function POST(request: Request) {
  try {
    await ensureDatabase();
    const payload = (await request.json()) as {
      market?: unknown;
      playerId?: unknown;
      nickname?: unknown;
    };
    if (!validMarket(payload.market))
      return Response.json({ error: "挑战市场无效" }, { status: 400, headers });
    const playerId = await requestPlayerId(request, payload.playerId);
    if (!playerId)
      return Response.json({ error: "玩家标识无效" }, { status: 400, headers });
    const nickname = cleanNickname(
      payload.nickname ?? requestDisplayName(request),
      playerId,
    );
    const { session, challengeId } = await startDuelHostSession(
      crypto.randomUUID(),
      payload.market,
      playerId,
    );
    const room = await createPendingDuelRoom({
      playerId,
      date: session.date,
      market: payload.market,
      challengeId,
      nickname,
    });
    return Response.json(
      {
        session,
        duel: {
          code: room.code,
          date: room.challengeDate,
          chainDepth: room.chainDepth,
        },
      },
      { headers },
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "挑战房间创建失败" },
      { status: 500, headers },
    );
  }
}
