import { eq } from "drizzle-orm";
import { ensureDatabase, getDb } from "../../../db";
import { duelChallenges, duelEvents } from "../../../db/schema";
import { requestPlayerId } from "../../request-identity";
import { normalizeShareSource, type ShareSource } from "../../share-links";

type DuelEventType = "view" | "start" | "share";

const EVENT_TYPES = new Set<DuelEventType>(["view", "start", "share"]);
const SHARE_SOURCES = new Set<ShareSource>([
  "native",
  "x",
  "whatsapp",
  "telegram",
  "reddit",
  "bluesky",
  "qr",
  "copy",
  "direct",
]);
const headers = { "cache-control": "no-store" };

function validEventType(value: unknown): value is DuelEventType {
  return typeof value === "string" && EVENT_TYPES.has(value as DuelEventType);
}

function validSource(value: unknown): value is ShareSource {
  return typeof value === "string" && SHARE_SOURCES.has(value as ShareSource);
}

export async function POST(request: Request) {
  try {
    await ensureDatabase();
    const payload = (await request.json()) as {
      code?: unknown;
      playerId?: unknown;
      eventType?: unknown;
      source?: unknown;
    };
    if (typeof payload.code !== "string" || !/^[A-Z0-9]{8,12}$/i.test(payload.code))
      return Response.json({ error: "挑战码无效" }, { status: 400, headers });
    if (!validEventType(payload.eventType))
      return Response.json({ error: "事件类型无效" }, { status: 400, headers });
    if (!validSource(payload.source))
      return Response.json({ error: "分享来源无效" }, { status: 400, headers });
    const playerId = await requestPlayerId(request, payload.playerId);
    if (!playerId)
      return Response.json({ error: "玩家标识无效" }, { status: 400, headers });

    const code = payload.code.toUpperCase();
    const [room] = await getDb()
      .select({ code: duelChallenges.code })
      .from(duelChallenges)
      .where(eq(duelChallenges.code, code))
      .limit(1);
    if (!room)
      return Response.json({ error: "挑战不存在" }, { status: 404, headers });

    await getDb()
      .insert(duelEvents)
      .values({
        id: crypto.randomUUID(),
        duelCode: code,
        playerId,
        eventType: payload.eventType,
        source: normalizeShareSource(payload.source),
      })
      .onConflictDoNothing({
        target: [
          duelEvents.duelCode,
          duelEvents.playerId,
          duelEvents.eventType,
          duelEvents.source,
        ],
      });
    return new Response(null, { status: 204, headers });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "事件记录失败" },
      { status: 500, headers },
    );
  }
}
