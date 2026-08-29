import { getPracticeBundle } from "../../game-core";

export async function GET(request: Request) {
  const seed = new URL(request.url).searchParams.get("seed")?.slice(0, 100) || crypto.randomUUID();
  return Response.json(getPracticeBundle(seed), {
    headers: { "cache-control": "no-store" },
  });
}
