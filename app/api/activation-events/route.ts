import { ensureDatabase, getDb } from "../../../db";
import { activationEvents } from "../../../db/schema";
import { requestPlayerId } from "../../request-identity";

export type ActivationEventType =
  | "lobby_view"
  | "guide_start"
  | "guide_forecast"
  | "guide_reveal"
  | "daily_first_move"
  | "daily_second_move"
  | "practice_second_move"
  | "daily_complete"
  | "daily_score_card_share"
  | "daily_style_card_share"
  | "crew_view"
  | "crew_create"
  | "crew_join"
  | "crew_first_invite_share"
  | "crew_invite_share"
  | "crew_daily_checkin";
export type ActivationSource = "lobby" | "direct" | "duel" | "crew";

const EVENT_TYPES = new Set<ActivationEventType>([
  "lobby_view",
  "guide_start",
  "guide_forecast",
  "guide_reveal",
  "daily_first_move",
  "daily_second_move",
  "practice_second_move",
  "daily_complete",
  "daily_score_card_share",
  "daily_style_card_share",
  "crew_view",
  "crew_create",
  "crew_join",
  "crew_first_invite_share",
  "crew_invite_share",
  "crew_daily_checkin",
]);
const SOURCES = new Set<ActivationSource>(["lobby", "direct", "duel", "crew"]);
const headers = { "cache-control": "no-store" };

export async function POST(request: Request) {
  try {
    await ensureDatabase();
    const payload = (await request.json()) as {
      playerId?: unknown;
      eventType?: unknown;
      source?: unknown;
    };
    if (
      typeof payload.eventType !== "string" ||
      !EVENT_TYPES.has(payload.eventType as ActivationEventType)
    )
      return Response.json({ error: "激活事件无效" }, { status: 400, headers });
    if (
      typeof payload.source !== "string" ||
      !SOURCES.has(payload.source as ActivationSource)
    )
      return Response.json({ error: "激活来源无效" }, { status: 400, headers });
    const playerId = await requestPlayerId(request, payload.playerId);
    if (!playerId)
      return Response.json({ error: "玩家标识无效" }, { status: 400, headers });

    await getDb()
      .insert(activationEvents)
      .values({
        id: crypto.randomUUID(),
        playerId,
        eventType: payload.eventType,
        source: payload.source,
      })
      .onConflictDoNothing({
        target: [
          activationEvents.playerId,
          activationEvents.eventType,
          activationEvents.source,
        ],
      });
    return new Response(null, { status: 204, headers });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "激活事件记录失败" },
      { status: 500, headers },
    );
  }
}
