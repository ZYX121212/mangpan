import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  MARKET_RUN_DECISIONS,
  MARKET_RUN_STAGES,
  marketRunGrade,
  marketRunTotal,
  newMarketRunProgress,
  parseMarketRunProgress,
  recordMarketRunStage,
} from "../app/market-run.ts";

test("defines a bounded five-market difficulty curve", () => {
  assert.equal(MARKET_RUN_DECISIONS, 5);
  assert.equal(MARKET_RUN_STAGES.length, 5);
  assert.deepEqual(
    MARKET_RUN_STAGES.map((stage) => stage.difficulty),
    ["starter", "starter", "standard", "standard", "expert"],
  );
  assert.equal(MARKET_RUN_STAGES.at(-1).scenario, "random");
});

test("records each finished market once and clamps untrusted scores", () => {
  const start = newMarketRunProgress("us", 1000);
  const first = recordMarketRunStage(start, "session-1", 108.4);
  assert.deepEqual(first.scores, [100]);
  assert.equal(recordMarketRunStage(first, "session-1", 40), first);
  const second = recordMarketRunStage(first, "session-2", -5);
  assert.deepEqual(second.scores, [100, 0]);
});

test("restores only valid bounded progress", () => {
  const restored = parseMarketRunProgress(
    JSON.stringify({
      market: "cn",
      scores: [91.2, "bad", 72, 68, 61, 99],
      completedSessionIds: ["one", 2, "three"],
      startedAt: 123,
    }),
    "us",
  );
  assert.equal(restored.market, "us");
  assert.deepEqual(restored.scores, [91, 72, 68, 61, 99]);
  assert.deepEqual(restored.completedSessionIds, ["one", "three"]);
  assert.equal(restored.startedAt, 123);
});

test("turns the five scores into a clear total and grade", () => {
  assert.equal(marketRunTotal([80, 75, 70, 85, 90]), 400);
  assert.equal(marketRunGrade([90, 90, 80, 85, 85]), "S");
  assert.equal(marketRunGrade([72, 72, 72]), "A");
  assert.equal(marketRunGrade([60, 60, 60]), "B");
  assert.equal(marketRunGrade([40, 40]), "C");
});

test("keeps Market Run a separate route with a one-click continuation", async () => {
  const [lobby, modePage, runPage, game] = await Promise.all([
    readFile(new URL("../app/mode-lobby.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/game-mode-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/run/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/game-client.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(lobby, /href: "\/run"/);
  assert.doesNotMatch(lobby, /title: \{ en: "Endless Practice"/);
  assert.match(modePage, /mode === "run" \? MARKET_RUN_STAGES\[0\]\.scenario/);
  assert.match(runPage, /<GameModePage mode="run"/);
  assert.match(game, /advanced\.decisionsUsed >= MARKET_RUN_DECISIONS/);
  assert.match(game, /continueMarketRun/);
  assert.match(game, /marketRunSessionStorageKey/);
});
