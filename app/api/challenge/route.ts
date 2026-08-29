import {
  advanceSession,
  revealSession,
  startDailySession,
  startPracticeSession,
} from "../../challenge-sessions";
import { chinaDate, type MarketKind } from "../../game-config";
import type { ScenarioKind } from "../../market-data";

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

function errorResponse(error: unknown) {
  return Response.json(
    { error: error instanceof Error ? error.message : "挑战暂时不可用" },
    { status: 400, headers },
  );
}

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const market = marketFrom(params.get("market"));
    const mode = params.get("mode") === "daily" ? "daily" : "practice";
    const session =
      mode === "daily"
        ? await startDailySession(chinaDate(), market)
        : await startPracticeSession(
            params.get("seed")?.slice(0, 100) || crypto.randomUUID(),
            market,
            scenarioFrom(params.get("scenario")),
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
    };
    if (
      typeof payload.sessionId !== "string" ||
      !/^[a-f0-9-]{30,40}$/i.test(payload.sessionId)
    ) {
      return Response.json({ error: "挑战会话无效" }, { status: 400, headers });
    }
    return Response.json(
      await advanceSession(payload.sessionId, payload.action),
      { headers },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const payload = (await request.json()) as { sessionId?: unknown };
    if (
      typeof payload.sessionId !== "string" ||
      !/^[a-f0-9-]{30,40}$/i.test(payload.sessionId)
    ) {
      return Response.json({ error: "挑战会话无效" }, { status: 400, headers });
    }
    return Response.json(await revealSession(payload.sessionId), { headers });
  } catch (error) {
    return errorResponse(error);
  }
}
