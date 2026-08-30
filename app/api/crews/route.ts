import {
  createCrew,
  getCrewSummary,
  joinCrew,
  listPlayerCrews,
} from "../../crew-service";
import {
  requestDisplayName,
  requestPlayerId,
  validPlayerId,
} from "../../request-identity";

export const dynamic = "force-dynamic";

function validMarket(value: unknown): value is "us" | "cn" {
  return value === "us" || value === "cn";
}

function errorStatus(message: string) {
  if (/not found/i.test(message)) return 404;
  if (/full|up to five/i.test(message)) return 409;
  if (/invalid|short/i.test(message)) return 400;
  return 500;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const playerId = await requestPlayerId(
      request,
      url.searchParams.get("playerId"),
    );
    if (playerId && !validPlayerId(playerId))
      return Response.json({ error: "Player ID is invalid." }, { status: 400 });
    const code = url.searchParams.get("code");
    if (code) {
      const crew = await getCrewSummary(code, playerId);
      if (!crew)
        return Response.json({ error: "Crew not found." }, { status: 404 });
      return Response.json({ crew }, { headers: { "cache-control": "no-store" } });
    }
    if (!playerId)
      return Response.json({ error: "Player ID is required." }, { status: 400 });
    return Response.json(
      { crews: await listPlayerCrews(playerId) },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Crews are unavailable.";
    return Response.json({ error: message }, { status: errorStatus(message) });
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      action?: unknown;
      code?: unknown;
      market?: unknown;
      name?: unknown;
      nickname?: unknown;
      playerId?: unknown;
    };
    const playerId = await requestPlayerId(request, payload.playerId);
    if (!playerId || !validPlayerId(playerId))
      return Response.json({ error: "Player ID is invalid." }, { status: 400 });
    const nickname =
      typeof payload.nickname === "string"
        ? payload.nickname
        : requestDisplayName(request) || "";
    if (payload.action === "create") {
      if (!validMarket(payload.market))
        return Response.json({ error: "Market is invalid." }, { status: 400 });
      if (typeof payload.name !== "string")
        return Response.json({ error: "Crew name is required." }, { status: 400 });
      const crew = await createCrew({
        playerId,
        nickname,
        name: payload.name,
        market: payload.market,
      });
      return Response.json({ crew }, { status: 201 });
    }
    if (payload.action === "join") {
      if (typeof payload.code !== "string")
        return Response.json({ error: "Crew code is required." }, { status: 400 });
      const crew = await joinCrew({ code: payload.code, playerId, nickname });
      return Response.json({ crew });
    }
    return Response.json({ error: "Action is invalid." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Crew update failed.";
    return Response.json({ error: message }, { status: errorStatus(message) });
  }
}
