import { and, asc, count, desc, eq } from "drizzle-orm";
import { ensureDatabase, getD1Database, getDb } from "../db";
import {
  activationEvents,
  crewCheckins,
  crewMembers,
  crews,
  dailyScores,
  players,
} from "../db/schema";
import { displayedCrewStreak } from "./crew-streak";
import { GAME_VERSION, marketDate, type MarketKind } from "./game-core";

export const CREW_CAPACITY = 5;

export type CrewSummary = {
  code: string;
  name: string;
  market: MarketKind;
  currentStreak: number;
  bestStreak: number;
  lastCompletedDate: string | null;
  memberCount: number;
  capacity: number;
  completedToday: number;
  allDoneToday: boolean;
  isMember: boolean;
  isOwner: boolean;
  members: {
    nickname: string;
    slot: number;
    completedToday: boolean;
    isViewer: boolean;
  }[];
};

function validCrewCode(value: string) {
  return /^[A-Z0-9]{8}$/.test(value);
}

function cleanText(value: string, maxLength: number) {
  return [...value]
    .filter((character) => {
      const code = character.charCodeAt(0);
      return character !== "<" && character !== ">" && code >= 32 && code !== 127;
    })
    .join("")
    .trim()
    .slice(0, maxLength);
}

export function cleanCrewName(value: string) {
  return cleanText(value, 24);
}

export function cleanCrewNickname(value: string, playerId: string) {
  return cleanText(value, 12) || `Trader ${playerId.slice(-4).toUpperCase()}`;
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

async function refreshCompletedCrewDay(code: string, date: string) {
  const db = getDb();
  const [[memberTotal], [checkinTotal]] = await Promise.all([
    db
      .select({ total: count() })
      .from(crewMembers)
      .where(eq(crewMembers.crewCode, code)),
    db
      .select({ total: count() })
      .from(crewCheckins)
      .where(
        and(
          eq(crewCheckins.crewCode, code),
          eq(crewCheckins.checkinDate, date),
        ),
      ),
  ]);
  const members = Number(memberTotal?.total ?? 0);
  const checkins = Number(checkinTotal?.total ?? 0);
  if (members < 2 || checkins < members) return;
  const previous = addDays(date, -1);
  await getD1Database()
    .prepare(`UPDATE crews
      SET current_streak = CASE
            WHEN last_completed_date = ? THEN current_streak + 1
            ELSE 1
          END,
          best_streak = MAX(best_streak, CASE
            WHEN last_completed_date = ? THEN current_streak + 1
            ELSE 1
          END),
          last_completed_date = ?
      WHERE code = ?
        AND (last_completed_date IS NULL OR last_completed_date <> ?)`)
    .bind(previous, previous, date, code, date)
    .run();
}

async function addCheckin(
  code: string,
  playerId: string,
  date: string,
  score: number,
) {
  await getDb()
    .insert(crewCheckins)
    .values({
      id: `${code}:${playerId}:${date}`,
      crewCode: code,
      playerId,
      checkinDate: date,
      score,
    })
    .onConflictDoNothing({
      target: [
        crewCheckins.crewCode,
        crewCheckins.playerId,
        crewCheckins.checkinDate,
      ],
    });
  await refreshCompletedCrewDay(code, date);
}

async function syncMemberToday(
  crew: typeof crews.$inferSelect,
  playerId: string,
) {
  const today = marketDate(crew.market as MarketKind);
  const storageDate = `${today}@${GAME_VERSION}@${crew.market}`;
  const [score] = await getDb()
    .select({ score: dailyScores.score })
    .from(dailyScores)
    .where(
      and(
        eq(dailyScores.challengeDate, storageDate),
        eq(dailyScores.playerId, playerId),
      ),
    )
    .limit(1);
  if (score) await addCheckin(crew.code, playerId, today, score.score);
}

export async function getCrewSummary(
  rawCode: string,
  viewerPlayerId?: string,
): Promise<CrewSummary | null> {
  await ensureDatabase();
  const code = rawCode.trim().toUpperCase();
  if (!validCrewCode(code)) return null;
  const db = getDb();
  const [initialCrew] = await db
    .select()
    .from(crews)
    .where(eq(crews.code, code))
    .limit(1);
  if (!initialCrew || (initialCrew.market !== "us" && initialCrew.market !== "cn"))
    return null;
  let crew = initialCrew;
  const viewerMembership = viewerPlayerId
    ? (
        await db
          .select()
          .from(crewMembers)
          .where(
            and(
              eq(crewMembers.crewCode, code),
              eq(crewMembers.playerId, viewerPlayerId),
            ),
          )
          .limit(1)
      )[0]
    : undefined;
  if (viewerMembership && viewerPlayerId) {
    await syncMemberToday(crew, viewerPlayerId);
    [crew] = await db
      .select()
      .from(crews)
      .where(eq(crews.code, code))
      .limit(1);
  }
  const today = marketDate(crew.market);
  const [memberRows, checkinRows] = await Promise.all([
    db
      .select()
      .from(crewMembers)
      .where(eq(crewMembers.crewCode, code))
      .orderBy(asc(crewMembers.slot)),
    db
      .select()
      .from(crewCheckins)
      .where(
        and(
          eq(crewCheckins.crewCode, code),
          eq(crewCheckins.checkinDate, today),
        ),
      ),
  ]);
  const checkins = new Map(
    checkinRows.map((row) => [row.playerId, row.score] as const),
  );
  const members = memberRows.map((member) => ({
    nickname: member.nickname,
    slot: member.slot,
    completedToday: checkins.has(member.playerId),
    isViewer: member.playerId === viewerPlayerId,
  }));
  return {
    code: crew.code,
    name: crew.name,
    market: crew.market,
    currentStreak: displayedCrewStreak(
      crew.currentStreak,
      crew.lastCompletedDate,
      today,
    ),
    bestStreak: crew.bestStreak,
    lastCompletedDate: crew.lastCompletedDate,
    memberCount: members.length,
    capacity: CREW_CAPACITY,
    completedToday: checkins.size,
    allDoneToday: members.length >= 2 && checkins.size >= members.length,
    isMember: Boolean(viewerMembership),
    isOwner: crew.ownerPlayerId === viewerPlayerId,
    members,
  };
}

async function ensurePlayer(playerId: string, nickname: string) {
  await getDb()
    .insert(players)
    .values({ id: playerId, nickname })
    .onConflictDoUpdate({
      target: players.id,
      set: { nickname, updatedAt: new Date().toISOString() },
    });
}

async function enforceMembershipLimit(playerId: string) {
  const [row] = await getDb()
    .select({ total: count() })
    .from(crewMembers)
    .where(eq(crewMembers.playerId, playerId));
  if (Number(row?.total ?? 0) >= CREW_CAPACITY)
    throw new Error("You can join up to five crews.");
}

export async function createCrew(input: {
  playerId: string;
  nickname: string;
  name: string;
  market: MarketKind;
}) {
  await ensureDatabase();
  const name = cleanCrewName(input.name);
  if (name.length < 2) throw new Error("Crew name is too short.");
  const nickname = cleanCrewNickname(input.nickname, input.playerId);
  await enforceMembershipLimit(input.playerId);
  await ensurePlayer(input.playerId, nickname);
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();
    await getDb()
      .insert(crews)
      .values({
        code,
        name,
        ownerPlayerId: input.playerId,
        market: input.market,
      })
      .onConflictDoNothing();
    const [created] = await getDb()
      .select()
      .from(crews)
      .where(
        and(
          eq(crews.code, code),
          eq(crews.ownerPlayerId, input.playerId),
        ),
      )
      .limit(1);
    if (!created) continue;
    await getDb().insert(crewMembers).values({
      id: `${code}:${input.playerId}`,
      crewCode: code,
      playerId: input.playerId,
      nickname,
      slot: 1,
    });
    await syncMemberToday(created, input.playerId);
    return getCrewSummary(code, input.playerId);
  }
  throw new Error("Could not create a crew right now.");
}

export async function joinCrew(input: {
  code: string;
  playerId: string;
  nickname: string;
}) {
  await ensureDatabase();
  const code = input.code.trim().toUpperCase();
  if (!validCrewCode(code)) throw new Error("Crew code is invalid.");
  const [crew] = await getDb()
    .select()
    .from(crews)
    .where(eq(crews.code, code))
    .limit(1);
  if (!crew) throw new Error("Crew not found.");
  const [existing] = await getDb()
    .select()
    .from(crewMembers)
    .where(
      and(
        eq(crewMembers.crewCode, code),
        eq(crewMembers.playerId, input.playerId),
      ),
    )
    .limit(1);
  if (!existing) {
    await enforceMembershipLimit(input.playerId);
    const nickname = cleanCrewNickname(input.nickname, input.playerId);
    await ensurePlayer(input.playerId, nickname);
    for (let slot = 1; slot <= CREW_CAPACITY; slot++) {
      await getDb()
        .insert(crewMembers)
        .values({
          id: `${code}:${input.playerId}`,
          crewCode: code,
          playerId: input.playerId,
          nickname,
          slot,
        })
        .onConflictDoNothing();
      const [joined] = await getDb()
        .select()
        .from(crewMembers)
        .where(
          and(
            eq(crewMembers.crewCode, code),
            eq(crewMembers.playerId, input.playerId),
          ),
        )
        .limit(1);
      if (joined) break;
    }
  }
  const [membership] = await getDb()
    .select()
    .from(crewMembers)
    .where(
      and(
        eq(crewMembers.crewCode, code),
        eq(crewMembers.playerId, input.playerId),
      ),
    )
    .limit(1);
  if (!membership) throw new Error("This crew is full.");
  await syncMemberToday(crew, input.playerId);
  return getCrewSummary(code, input.playerId);
}

export async function listPlayerCrews(playerId: string) {
  await ensureDatabase();
  const memberships = await getDb()
    .select({ code: crewMembers.crewCode })
    .from(crewMembers)
    .where(eq(crewMembers.playerId, playerId))
    .orderBy(desc(crewMembers.joinedAt))
    .limit(CREW_CAPACITY);
  const summaries = await Promise.all(
    memberships.map(({ code }) => getCrewSummary(code, playerId)),
  );
  return summaries.filter((crew): crew is CrewSummary => Boolean(crew));
}

export async function recordCrewDailyCheckins(input: {
  playerId: string;
  market: MarketKind;
  date: string;
  score: number;
}) {
  await ensureDatabase();
  const memberships = await getDb()
    .select({ code: crewMembers.crewCode })
    .from(crewMembers)
    .innerJoin(crews, eq(crews.code, crewMembers.crewCode))
    .where(
      and(
        eq(crewMembers.playerId, input.playerId),
        eq(crews.market, input.market),
      ),
    );
  if (!memberships.length) return;
  await Promise.all(
    memberships.map(({ code }) =>
      addCheckin(code, input.playerId, input.date, input.score),
    ),
  );
  await getDb()
    .insert(activationEvents)
    .values({
      id: crypto.randomUUID(),
      playerId: input.playerId,
      eventType: "crew_daily_checkin",
      source: "crew",
    })
    .onConflictDoNothing({
      target: [
        activationEvents.playerId,
        activationEvents.eventType,
        activationEvents.source,
      ],
    });
}
