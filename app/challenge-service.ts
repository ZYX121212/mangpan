import { eq } from "drizzle-orm";
import { ensureDatabase, getDb } from "../db";
import { dailyChallenges } from "../db/schema";
import { GAME_VERSION, type MarketKind } from "./game-config";
import {
  getChallengeBundle,
  getPracticeBundle,
  type ChallengeBundle,
  type ScenarioDifficulty,
  type ScenarioKind,
} from "./market-data";

export function snapshotId(date: string, market: MarketKind) {
  return `${date}@${GAME_VERSION}@${market}`;
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++)
    bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function serializeBundle(bundle: ChallengeBundle) {
  const json = JSON.stringify(bundle);
  const stream = new Blob([json])
    .stream()
    .pipeThrough(new CompressionStream("gzip"));
  return `gzip:${bytesToBase64(new Uint8Array(await new Response(stream).arrayBuffer()))}`;
}

async function parseBundle(payload: string) {
  if (!payload.startsWith("gzip:"))
    return JSON.parse(payload) as ChallengeBundle;
  const stream = new Blob([base64ToBytes(payload.slice(5))])
    .stream()
    .pipeThrough(new DecompressionStream("gzip"));
  return JSON.parse(await new Response(stream).text()) as ChallengeBundle;
}

export async function getDailyChallengeBundle(
  date: string,
  market: MarketKind,
) {
  await ensureDatabase();
  const id = snapshotId(date, market);
  const db = getDb();
  const [existing] = await db
    .select({ payload: dailyChallenges.payload })
    .from(dailyChallenges)
    .where(eq(dailyChallenges.id, id))
    .limit(1);
  if (existing) return await parseBundle(existing.payload);

  const bundle = await getChallengeBundle(date, market);
  const payload = await serializeBundle(bundle);
  await db
    .insert(dailyChallenges)
    .values({
      id,
      challengeDate: date,
      market,
      payload,
      source: bundle.dataSource,
    })
    .onConflictDoNothing({ target: dailyChallenges.id });

  const [saved] = await db
    .select({ payload: dailyChallenges.payload })
    .from(dailyChallenges)
    .where(eq(dailyChallenges.id, id))
    .limit(1);
  return saved ? await parseBundle(saved.payload) : bundle;
}

export async function getStoredChallengeBundle(id: string) {
  await ensureDatabase();
  const db = getDb();
  const [stored] = await db
    .select({ payload: dailyChallenges.payload })
    .from(dailyChallenges)
    .where(eq(dailyChallenges.id, id))
    .limit(1);
  if (!stored) throw new Error("挑战不存在或已经过期");
  return await parseBundle(stored.payload);
}

export async function createPracticeChallenge(
  seedText: string,
  market: MarketKind,
  scenario: ScenarioKind = "random",
  difficulty: ScenarioDifficulty = "standard",
) {
  await ensureDatabase();
  const bundle = await getPracticeBundle(
    seedText,
    market,
    scenario,
    difficulty,
  );
  const id = `practice@${GAME_VERSION}@${market}@${crypto.randomUUID()}`;
  await getDb()
    .insert(dailyChallenges)
    .values({
      id,
      challengeDate: bundle.date,
      market,
      payload: await serializeBundle(bundle),
      source: bundle.dataSource,
    });
  return { id, bundle };
}
