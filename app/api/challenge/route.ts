import {
  abandonSession,
  advanceSession,
  revealSession,
  resumeLatestSession,
  resumeSession,
  startDailySession,
  startEndlessSession,
  startPracticeSession,
  startSprintSession,
} from "../../challenge-sessions";
import { marketDate, type MarketKind } from "../../game-config";
import type { ScenarioDifficulty, ScenarioKind } from "../../market-data";
import { requestPlayerId } from "../../request-identity";

const headers = { "cache-control": "no-store" };

function marketFrom(value: string | null): MarketKind {
  return value === "us" ? "us" : "cn";
}

function scenarioFrom(value: string | null): ScenarioKind {
  return value === "trend" ||
    value === "reversal" ||
    value === "crash" ||
    value === "volatile"
    ? value
    : "random";
}

function difficultyFrom(value: string | null): ScenarioDifficulty {
  return value === "starter" || value === "expert" ? value : "standard";
}

function errorResponse(error: unknown) {
  return Response.json(
    { error: error instanceof Error ? error.message : "挑战暂时不可用" },
    { status: 400, headers },
  );
}

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const playerId = await requestPlayerId(request, params.get("playerId"));
    if (params.get("resume") === "latest") {
      if (!playerId)
        return Response.json(
          { error: "恢复会话无效" },
          { status: 400, headers },
        );
      const latest = await resumeLatestSession(
        playerId,
        marketFrom(params.get("market")),
      );
      return latest
        ? Response.json(latest, { headers })
        : new Response(null, { status: 204, headers });
    }
    const resumeId = params.get("sessionId");
    if (resumeId) {
      if (!/^[a-f0-9-]{30,40}$/i.test(resumeId) || !playerId)
        return Response.json(
          { error: "恢复会话无效" },
          { status: 400, headers },
        );
      return Response.json(await resumeSession(resumeId, playerId), {
        headers,
      });
    }
    const market = marketFrom(params.get("market"));
    const mode =
      params.get("mode") === "daily"
        ? "daily"
        : params.get("mode") === "sprint"
          ? "sprint"
          : params.get("mode") === "endless"
            ? "endless"
          : "practice";
    const session =
      mode === "daily"
        ? await startDailySession(marketDate(market), market, playerId)
        : mode === "sprint"
          ? await startSprintSession(
              params.get("seed")?.slice(0, 100) || crypto.randomUUID(),
              market,
              playerId,
            )
          : mode === "endless"
            ? await startEndlessSession(
                params.get("seed")?.slice(0, 100) || crypto.randomUUID(),
                market,
                playerId,
              )
        : await startPracticeSession(
            params.get("seed")?.slice(0, 100) || crypto.randomUUID(),
            market,
            scenarioFrom(params.get("scenario")),
            difficultyFrom(params.get("difficulty")),
            playerId,
          );
    return Response.json(session, { headers });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      sessionId?: unknown;
      action?: unknown;
      playerId?: unknown;
    };
    if (
      typeof payload.sessionId !== "string" ||
      !/^[a-f0-9-]{30,40}$/i.test(payload.sessionId)
    ) {
      return Response.json({ error: "挑战会话无效" }, { status: 400, headers });
    }
    return Response.json(
      await advanceSession(
        payload.sessionId,
        payload.action,
        await requestPlayerId(request, payload.playerId),
      ),
      { headers },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const payload = (await request.json()) as {
      sessionId?: unknown;
      playerId?: unknown;
    };
    if (
      typeof payload.sessionId !== "string" ||
      !/^[a-f0-9-]{30,40}$/i.test(payload.sessionId)
    ) {
      return Response.json({ error: "挑战会话无效" }, { status: 400, headers });
    }
    return Response.json(
      await revealSession(
        payload.sessionId,
        await requestPlayerId(request, payload.playerId),
      ),
      { headers },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const payload = (await request.json()) as {
      sessionId?: unknown;
      playerId?: unknown;
    };
    if (
      typeof payload.sessionId !== "string" ||
      !/^[a-f0-9-]{30,40}$/i.test(payload.sessionId)
    ) {
      return Response.json({ error: "挑战会话无效" }, { status: 400, headers });
    }
    return Response.json(
      await abandonSession(
        payload.sessionId,
        await requestPlayerId(request, payload.playerId),
      ),
      { headers },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
