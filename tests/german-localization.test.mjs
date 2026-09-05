import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { translateEnglishToGerman } from "../app/i18n-de.ts";

const HAN = /[\u3400-\u9fff]/u;

test("translates the German first-play promise and guided loop", () => {
  const criticalCopy = [
    "Can you read what happens next?",
    "Make one forecast on a hidden piece of real market history, then reveal the answer. Learn the complete loop by playing—not by reading a tutorial.",
    "Read the chart, then make one forecast",
    "Choose an action and reveal three real days",
    "That is the whole loop",
    "Play today's global challenge →",
    "Read three charts to build your first real sample",
    "Next mystery chart →",
  ];
  for (const source of criticalCopy) {
    const translated = translateEnglishToGerman(source);
    assert.notEqual(translated, source);
    assert.doesNotMatch(translated, HAN);
  }
});

test("translates all five separated modes and dynamic German labels", () => {
  for (const mode of ["Daily Challenge", "Market Run", "Training Lab", "Friend Duel", "Crew Streak"]) {
    assert.notEqual(translateEnglishToGerman(mode), mode);
  }
  assert.equal(
    translateEnglishToGerman("Market 2/5 · Decision 3/5 · 12 trading days"),
    "Markt 2/5 · Entscheidung 3/5 · 12 Handelstage",
  );
});

test("keeps German coverage in parity with the established Spanish pack", async () => {
  const [spanish, german] = await Promise.all([
    readFile(new URL("../app/i18n-es.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/i18n-de.ts", import.meta.url), "utf8"),
  ]);
  const keys = (source) => [...source.matchAll(/^ {2}"([^"]+)":/gm)].map((match) => match[1]).sort();
  assert.deepEqual(keys(german), keys(spanish));
  assert.ok(keys(german).length >= 300);
});

test("connects German browser detection, controls, number formats, and portal locale", async () => {
  const [i18n, game, lobby, platform] = await Promise.all([
    readFile(new URL("../app/i18n.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/game-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/mode-lobby.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/web-game-platform.ts", import.meta.url), "utf8"),
  ]);
  assert.match(i18n, /normalized\.startsWith\("de"\)/);
  assert.match(i18n, /if \(locale === "de"\) return "de-DE"/);
  assert.match(i18n, /translateEnglishToGerman\(translated\)/);
  assert.match(game, /<option value="de">DE<\/option>/);
  assert.match(lobby, /<option value="de">DE<\/option>/);
  assert.match(platform, /normalized\.startsWith\("de"\)/);

  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  globalThis.window = {
    location: { hostname: "games.crazygames.com", search: "" },
    CrazyGames: {
      SDK: {
        async init() {},
        game: { gameplayStart() {}, gameplayStop() {} },
        user: { systemInfo: { locale: "de-DE" } },
      },
    },
  };
  globalThis.document = { referrer: "https://www.crazygames.com/" };
  try {
    const adapter = await import(`../app/web-game-platform.ts?german=${Date.now()}`);
    assert.equal((await adapter.getWebGameLaunchContext()).locale, "de");
  } finally {
    globalThis.window = previousWindow;
    globalThis.document = previousDocument;
  }
});
