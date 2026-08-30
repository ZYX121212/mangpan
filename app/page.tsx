import GameClient from "./game-client";
import { getChatGPTUser } from "./chatgpt-auth";
import { startDailySession } from "./challenge-sessions";
import { chinaDate } from "./game-config";
import { opaquePlayerId } from "./request-identity";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{ market?: string }>;
}) {
  const date = chinaDate();
  const market = (await searchParams)?.market === "cn" ? "cn" : "us";
  const user = await getChatGPTUser();
  const playerId = user ? await opaquePlayerId(user.userId) : undefined;
  const challenge = await startDailySession(date, market, playerId);
  return (
    <GameClient
      initialChallenge={challenge}
      initialIdentity={playerId ? { playerId, cloud: true } : null}
    />
  );
}
