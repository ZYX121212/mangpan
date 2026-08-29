import GameClient from "./game-client";
import { getChatGPTUser } from "./chatgpt-auth";
import { startDailySession } from "./challenge-sessions";
import { chinaDate } from "./game-config";
import { opaquePlayerId } from "./request-identity";

export const dynamic = "force-dynamic";

export default async function Page() {
  const date = chinaDate();
  const user = await getChatGPTUser();
  const playerId = user ? await opaquePlayerId(user.userId) : undefined;
  const [cn, us] = await Promise.all([
    startDailySession(date, "cn", playerId),
    startDailySession(date, "us", playerId),
  ]);
  return (
    <GameClient
      initialChallenges={{ cn, us }}
      initialIdentity={playerId ? { playerId, cloud: true } : null}
    />
  );
}
