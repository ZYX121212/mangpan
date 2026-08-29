import GameClient from "./game-client";
import { startDailySession } from "./challenge-sessions";
import { chinaDate } from "./game-config";

export default async function Page() {
  const date = chinaDate();
  const [cn, us] = await Promise.all([
    startDailySession(date, "cn"),
    startDailySession(date, "us"),
  ]);
  return <GameClient initialChallenges={{ cn, us }} />;
}
