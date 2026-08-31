import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("turns a finished solo chart into a visible three-chart session goal", async () => {
  const [game, styles] = await Promise.all([
    readFile(new URL("../app/game-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(
    game,
    /sessionChainCount, setSessionChainCount\] = useState\(0\)/,
  );
  assert.match(game, /setSessionChainCount\(\(value\) => value \+ 1\)/);
  assert.match(game, /result-session-goal/);
  assert.match(game, /Read three charts to build your first real sample/);
  assert.match(game, /Next mystery chart →/);
  assert.match(game, /Math\.min\(sessionChainCount, 3\)\}\/3/);
  assert.match(styles, /\.result-session-goal/);
  assert.match(styles, /@media\(max-width:620px\)\{\.result-session-goal/);
});

test("keeps the continuation out of social, crew, run, and training modes", async () => {
  const game = await readFile(
    new URL("../app/game-client.tsx", import.meta.url),
    "utf8",
  );

  assert.match(
    game,
    /const showSessionMomentum = Boolean\([\s\S]*!isMarketRun[\s\S]*!activeDuel[\s\S]*!initialCrewCode[\s\S]*!activeScenario[\s\S]*initialMode !== "training"/,
  );
  assert.match(
    game,
    /gameMode === "daily" && scoreStatus !== "done"/,
  );
});

test("loads the next hidden chart without adding another lobby mode", async () => {
  const [game, lobby] = await Promise.all([
    readFile(new URL("../app/game-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/mode-lobby.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(game, /const continueAfterResult = async/);
  assert.match(game, /history\.replaceState\(null, "", `\/practice\?market=\$\{market\}`\)/);
  assert.match(game, /await resetGame\("practice", market, "random", "standard"\)/);
  assert.equal((lobby.match(/number: "0[1-5]"/g) ?? []).length, 5);
});

test("measures next-chart continuation as a first-session funnel event", async () => {
  const [clientEvents, route, game] = await Promise.all([
    readFile(new URL("../app/activation-events.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../app/api/activation-events/route.ts", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/game-client.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(clientEvents, /"result_next_chart"/);
  assert.match(route, /"result_next_chart"/);
  assert.match(
    game,
    /trackActivationEvent\(playerId, "result_next_chart", "direct"\)/,
  );
});
