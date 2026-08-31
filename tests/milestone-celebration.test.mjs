import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  celebrationMilestone,
  isPlatformCelebration,
} from "../app/milestone-celebration.ts";

const BASE = {
  isMarketRun: false,
  marketRunFinished: false,
  isDaily: false,
  dailySettled: true,
  dailyPercentile: null,
  duelWon: false,
  streakGuardEarned: false,
  trainingMastered: false,
  sessionChartCount: 1,
  guidedFirstChart: false,
};

test("celebrates meaningful outcomes once, with rare achievements taking priority", () => {
  assert.equal(
    celebrationMilestone({ ...BASE, guidedFirstChart: true }),
    "first_chart",
  );
  assert.equal(
    celebrationMilestone({
      ...BASE,
      guidedFirstChart: true,
      sessionChartCount: 3,
    }),
    "three_chart_sample",
  );
  assert.equal(
    celebrationMilestone({
      ...BASE,
      trainingMastered: true,
      dailyPercentile: 94,
    }),
    "top_decile",
  );
  assert.equal(
    celebrationMilestone({
      ...BASE,
      duelWon: true,
      streakGuardEarned: true,
    }),
    "streak_guard",
  );
});

test("waits for verified daily settlement and saves the biggest run moment", () => {
  assert.equal(
    celebrationMilestone({
      ...BASE,
      isDaily: true,
      dailySettled: false,
      dailyPercentile: 99,
    }),
    null,
  );
  assert.equal(
    celebrationMilestone({
      ...BASE,
      isMarketRun: true,
      marketRunFinished: false,
      trainingMastered: true,
    }),
    null,
  );
  assert.equal(
    celebrationMilestone({
      ...BASE,
      isMarketRun: true,
      marketRunFinished: true,
    }),
    "market_run_complete",
  );
});

test("keeps portal celebrations rare and never treats onboarding as happy-time", () => {
  assert.equal(isPlatformCelebration("first_chart"), false);
  assert.equal(isPlatformCelebration("three_chart_sample"), true);
  assert.equal(isPlatformCelebration("market_run_complete"), true);
});

test("ships an accessible, motion-safe celebration and measures the outcome", async () => {
  const [game, styles, clientEvents, eventRoute] = await Promise.all([
    readFile(new URL("../app/game-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/activation-events.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../app/api/activation-events/route.ts", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(game, /celebrationMilestone\(\{/);
  assert.match(game, /role="status"/);
  assert.match(game, /aria-live="polite"/);
  assert.match(game, /setTimeout\(\(\) => setCelebration\(null\), 4400\)/);
  assert.match(game, /isPlatformCelebration\(milestone\)/);
  assert.match(styles, /\.milestone-celebration/);
  assert.match(styles, /prefers-reduced-motion:reduce/);
  assert.match(clientEvents, /"milestone_celebration"/);
  assert.match(eventRoute, /"milestone_celebration"/);
});

test("uses CrazyGames happy-time only through the non-blocking platform adapter", async () => {
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  let celebrations = 0;
  globalThis.window = {
    location: { hostname: "games.crazygames.com", search: "" },
    CrazyGames: {
      SDK: {
        async init() {},
        game: {
          gameplayStart() {},
          gameplayStop() {},
          happytime() {
            celebrations += 1;
          },
        },
      },
    },
  };
  globalThis.document = { referrer: "https://www.crazygames.com/" };
  try {
    const adapter = await import(
      `../app/web-game-platform.ts?happy-time=${Date.now()}`
    );
    await adapter.reportPlatformHappyTime();
    assert.equal(celebrations, 1);
  } finally {
    globalThis.window = previousWindow;
    globalThis.document = previousDocument;
  }
});
