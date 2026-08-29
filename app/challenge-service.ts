import { eq } from "drizzle-orm";
import { ensureDatabase, getDb } from "../db";
import { dailyChallenges } from "../db/schema";
import { GAME_VERSION, type MarketKind } from "./game-config";
import { getChallengeBundle, type ChallengeBundle } from "./market-data";

function snapshotId(date: string, market: MarketKind) {
  return `${date}@${GAME_VERSION}@${market}`;
}

function parseBundle(payload: string) {
  return JSON.parse(payload) as ChallengeBundle;
}

export async function getDailyChallengeBundle(date: string, market: MarketKind) {
  await ensureDatabase();
  const id = snapshotId(date, market);
  const db = getDb();
  const [existing] = await db.select({ payload: dailyChallenges.payload }).from(dailyChallenges).where(eq(dailyChallenges.id, id)).limit(1);
  if (existing) return parseBundle(existing.payload);

  const bundle = await getChallengeBundle(date, market);
  await db.insert(dailyChallenges).values({
    id,
    challengeDate: date,
    market,
    payload: JSON.stringify(bundle),
    source: bundle.dataSource,
  }).onConflictDoNothing({ target: dailyChallenges.id });

  const [saved] = await db.select({ payload: dailyChallenges.payload }).from(dailyChallenges).where(eq(dailyChallenges.id, id)).limit(1);
  return saved ? parseBundle(saved.payload) : bundle;
}
