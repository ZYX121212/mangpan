import GameClient from "./game-client";
import { getChatGPTUser } from "./chatgpt-auth";
import {
  startDailySession,
  startEndlessSession,
  startPracticeSession,
  startSprintSession,
} from "./challenge-sessions";
import { marketDate, type MarketKind } from "./game-config";
import { MARKET_RUN_STAGES } from "./market-run";
import { opaquePlayerId } from "./request-identity";

function boundedInteger(value: string | undefined, maximum: number) {
  if (!value || !/^\d+$/u.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= maximum
    ? parsed
    : undefined;
}

export type GameEntryMode =
  | "daily"
  | "practice"
  | "sprint"
  | "endless"
  | "training"
  | "run";

export default async function GameModePage({
  mode,
  searchParams,
}: {
  mode: GameEntryMode;
  searchParams?: Promise<{
    market?: string;
    guide?: string;
    crew?: string;
    seed?: string;
    targetDays?: string;
    targetScore?: string;
  }>;
}) {
  const params = await searchParams;
  const market: MarketKind = params?.market === "cn" ? "cn" : "us";
  const endlessSeed =
    mode === "endless"
      ? params?.seed?.trim().slice(0, 100) || crypto.randomUUID()
      : undefined;
  const endlessTargetDays =
    mode === "endless" ? boundedInteger(params?.targetDays, 100_000) : undefined;
  const endlessTargetScore =
    mode === "endless" ? boundedInteger(params?.targetScore, 100) : undefined;
  const initialGuide = mode === "practice" && params?.guide === "1";
  const requestedCrewCode = params?.crew?.trim().toUpperCase();
  const initialCrewCode =
    mode === "daily" && requestedCrewCode && /^[A-Z0-9]{8}$/.test(requestedCrewCode)
      ? requestedCrewCode
      : undefined;
  const user = await getChatGPTUser();
  const playerId = user ? await opaquePlayerId(user.userId) : undefined;
  const challenge =
    mode === "daily"
      ? await startDailySession(marketDate(market), market, playerId)
      : mode === "sprint"
        ? await startSprintSession(crypto.randomUUID(), market, playerId)
      : mode === "endless"
        ? await startEndlessSession(endlessSeed!, market, playerId)
      : await startPracticeSession(
          `${mode}-${crypto.randomUUID()}`,
          market,
          mode === "run" ? MARKET_RUN_STAGES[0].scenario : "random",
          mode === "run" ? MARKET_RUN_STAGES[0].difficulty : "standard",
          playerId,
          initialGuide,
        );

  return (
    <GameClient
      initialChallenge={challenge}
      initialIdentity={playerId ? { playerId, cloud: true } : null}
      initialMode={mode}
      initialGuide={initialGuide}
      initialCrewCode={initialCrewCode}
      initialEndlessSeed={endlessSeed}
      initialEndlessSeedFromLink={mode === "endless" && Boolean(params?.seed)}
      initialEndlessTargetDays={endlessTargetDays}
      initialEndlessTargetScore={endlessTargetScore}
    />
  );
}
