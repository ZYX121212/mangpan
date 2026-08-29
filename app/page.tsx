import GameClient from "./game-client";
import { chinaDate } from "./game-config";
import { getChallengeBundle } from "./game-core";

export default function Page() {
  const date = chinaDate();
  return <GameClient initialChallenges={{ cn: getChallengeBundle(date, "cn"), us: getChallengeBundle(date, "us") }} />;
}
