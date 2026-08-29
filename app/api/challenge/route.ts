import type { MarketKind } from "../../game-config";
import { getPracticeBundle } from "../../market-data";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const seed = params.get("seed")?.slice(0, 100) || crypto.randomUUID();
  const market: MarketKind = params.get("market") === "us" ? "us" : "cn";
  return Response.json(await getPracticeBundle(seed, market), {
    headers: { "cache-control": "no-store" },
  });
}
