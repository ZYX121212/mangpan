import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("turns a completed five-stage market run into a spoiler-free share loop", async () => {
  const [client, activation, route] = await Promise.all([
    readFile(new URL("../app/game-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/activation-events.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/activation-events/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(client, /runTitle: string/);
  assert.match(client, /runChallenge: \(grade: string, total: number\)/);
  assert.match(client, /runCompact: \(grade: string, total: number, sequence: string\)/);
  assert.match(client, /const runGrade = marketRunGrade\(marketRunProgress\.scores\)/);
  assert.match(client, /shareCopy\.runChallenge\(runGrade, runTotal\)/);
  assert.match(client, /shareCopy\.runCompact\(runGrade, runTotal, sequence\)/);
  assert.match(client, /isMarketRun && marketRunFinished/);
  assert.match(client, /SHARE YOUR MARKET RUN/);
  assert.match(client, /five-stage score/);
  assert.match(client, /isMarketRun\s*\? "run_share"/);
  assert.match(activation, /\| "run_share"/);
  assert.match(route, /"run_share"/);
});

