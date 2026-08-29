import GameClient from "./game-client";
import { getDailyChallengeBundle } from "./challenge-service";
import { chinaDate } from "./game-config";

export default async function Page() {
  const date = chinaDate();
  const [cn, us] = await Promise.all([getDailyChallengeBundle(date, "cn"), getDailyChallengeBundle(date, "us")]);
  return <GameClient initialChallenges={{ cn, us }} />;
}
