import GameClient from "./game-client";
import { chinaDate } from "./game-config";
import { getChallengeBundle } from "./game-core";

export default function Page() {
  const date = chinaDate();
  return <GameClient initialChallenge={getChallengeBundle(date)} />;
}
