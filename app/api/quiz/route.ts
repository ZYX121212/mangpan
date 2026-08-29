import {
  answerPatternQuiz,
  getTrainingProfile,
  startPatternQuiz,
} from "../../challenge-sessions";
import type { ConfidenceLevel, MarketKind } from "../../game-config";
import type { ScenarioDifficulty } from "../../market-data";
import { requestPlayerId } from "../../request-identity";

const responseHeaders = { "cache-control": "no-store" };
const quizScenarios = ["trend", "reversal", "crash", "volatile"] as const;

function marketFrom(value: string | null): MarketKind {
  return value === "us" ? "us" : "cn";
}

function difficultyFrom(value: string | null): ScenarioDifficulty {
  return value === "starter" || value === "expert" ? value : "standard";
}

function errorResponse(error: unknown) {
  return Response.json(
    { error: error instanceof Error ? error.message : "识别训练暂时不可用" },
    { status: 400, headers: responseHeaders },
  );
}

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const playerId = await requestPlayerId(request, params.get("playerId"));
    if (!playerId)
      return Response.json(
        { error: "请先建立训练身份" },
        { status: 400, headers: responseHeaders },
      );
    return Response.json(
      await startPatternQuiz(
        params.get("seed")?.slice(0, 100) || crypto.randomUUID(),
        marketFrom(params.get("market")),
        difficultyFrom(params.get("difficulty")),
        playerId,
      ),
      { headers: responseHeaders },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      quizId?: unknown;
      answer?: unknown;
      confidence?: unknown;
      playerId?: unknown;
    };
    const playerId = await requestPlayerId(request, payload.playerId);
    if (
      !playerId ||
      typeof payload.quizId !== "string" ||
      !/^[a-f0-9-]{30,40}$/i.test(payload.quizId) ||
      !quizScenarios.includes(
        payload.answer as (typeof quizScenarios)[number],
      ) ||
      !(payload.confidence === 1 ||
        payload.confidence === 2 ||
        payload.confidence === 3)
    )
      return Response.json(
        { error: "识别答案无效" },
        { status: 400, headers: responseHeaders },
      );
    const result = await answerPatternQuiz(
      payload.quizId,
      playerId,
      payload.answer as (typeof quizScenarios)[number],
      payload.confidence as ConfidenceLevel,
    );
    return Response.json(
      {
        ...result,
        trainingProfile: await getTrainingProfile(playerId, result.market),
      },
      { headers: responseHeaders },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
