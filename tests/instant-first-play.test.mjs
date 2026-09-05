import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("sends a first-time player straight into the playable beginner chart", async () => {
  const lobby = await readFile(
    new URL("../app/mode-lobby.tsx", import.meta.url),
    "utf8",
  );

  assert.match(lobby, /const firstChartHref = `\/practice\?market=\$\{resolvedMarket\}&guide=1`/);
  assert.match(lobby, /router\.prefetch\(firstChartHref\)/);
  assert.match(lobby, /!hasPriorActivity && !browseModes/);
  assert.match(lobby, /router\.replace\(firstChartHref\)/);
  assert.match(lobby, /new URLSearchParams\(location\.search\)\.get\("modes"\) === "1"/);
  assert.ok(
    lobby.indexOf("context.duelCode") < lobby.indexOf("router.replace(firstChartHref)"),
    "direct game invites must win over automatic first play",
  );
  assert.doesNotMatch(lobby, /trackActivationEvent\([^)]*"guide_start"/);
});

test("keeps mode choice reachable and measures the full first-play funnel", async () => {
  const [game, events, eventRoute, styles] = await Promise.all([
    readFile(new URL("../app/game-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/activation-events.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../app/api/activation-events/route.ts", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(game, /href=\{initialGuide \? "\/\?modes=1" : "\/"\}/);
  assert.match(game, /"guide_complete"/);
  assert.match(game, /"guide_daily_continue"/);
  assert.match(game, /completeOnboarding\(false\)/);
  assert.match(game, /gameMode === "daily" \|\| isMarketRun \|\| guidedRunActive/);
  assert.match(game, /useState<OnboardingStep>\(initialGuide \? 1 : 0\)/);
  assert.match(game, /guidedRunActive \? "guided-first-play" : ""/);
  assert.match(game, /data-onboarding-step=\{onboardingStep \|\| undefined\}/);
  assert.match(game, /READ CONFIRMED/);
  assert.match(game, /NEW EVIDENCE/);
  assert.match(events, /\| "guide_complete"/);
  assert.match(events, /\| "guide_daily_continue"/);
  assert.match(events, /\| "session_three_minutes"/);
  assert.match(eventRoute, /"guide_complete",/);
  assert.match(eventRoute, /"guide_daily_continue",/);
  assert.match(eventRoute, /"session_three_minutes",/);
  assert.match(game, /setTimeout\(trackIfVisible, 180_000\)/);
  assert.match(styles, /\.first-run-verdict\.matched/);
  assert.match(styles, /\.first-run-verdict\.surprised/);
  assert.match(styles, /\.shell\.guided-first-play \.(quantity-field|fee-preview)/);
  assert.match(styles, /data-onboarding-step="1"/);
});
