import GameClient from "./game-client";
import { getChatGPTUser } from "./chatgpt-auth";
import {
  startDailySession,
  startPracticeSession,
} from "./challenge-sessions";
import { marketDate, type MarketKind } from "./game-config";
import { opaquePlayerId } from "./request-identity";

export type GameEntryMode = "daily" | "practice" | "training";

export default async function GameModePage({
  mode,
  searchParams,
}: {
  mode: GameEntryMode;
  searchParams?: Promise<{ market?: string }>;
}) {
  const market: MarketKind =
    (await searchParams)?.market === "cn" ? "cn" : "us";
  const user = await getChatGPTUser();
  const playerId = user ? await opaquePlayerId(user.userId) : undefined;
  const challenge =
    mode === "daily"
      ? await startDailySession(marketDate(market), market, playerId)
      : await startPracticeSession(
          `${mode}-${crypto.randomUUID()}`,
          market,
          "random",
          "standard",
          playerId,
        );

  return (
    <GameClient
      initialChallenge={challenge}
      initialIdentity={playerId ? { playerId, cloud: true } : null}
      initialMode={mode}
    />
  );
}
