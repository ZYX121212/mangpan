import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { translateEnglishToItalian } from "../app/i18n-it.ts";

const HAN = /[\u3400-\u9fff]/u;

test("translates the Italian first-play promise and guided loop", () => {
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
    const translated = translateEnglishToItalian(source);
    assert.notEqual(translated, source);
    assert.doesNotMatch(translated, HAN);
  }
});

test("translates all five separated modes and dynamic Italian labels", () => {
  for (const mode of ["Daily Challenge", "Market Run", "Training Lab", "Friend Duel", "Crew Streak"]) {
    assert.notEqual(translateEnglishToItalian(mode), mode);
  }
  assert.equal(
    translateEnglishToItalian("Market 2/5 · Decision 3/5 · 12 trading days"),
    "Mercato 2/5 · Decisione 3/5 · 12 giorni di mercato",
  );
});

test("keeps Italian coverage in parity with the established Spanish pack", async () => {
  const [spanish, italian] = await Promise.all([
    readFile(new URL("../app/i18n-es.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/i18n-it.ts", import.meta.url), "utf8"),
  ]);
  const keys = (source) => [...source.matchAll(/^ {2}"([^"]+)":/gm)].map((match) => match[1]).sort();
  assert.deepEqual(keys(italian), keys(spanish));
  assert.ok(keys(italian).length >= 300);
});

test("connects Italian browser detection, controls, number formats, and portal locale", async () => {
  const [i18n, game, lobby, platform] = await Promise.all([
    readFile(new URL("../app/i18n.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/game-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/mode-lobby.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/web-game-platform.ts", import.meta.url), "utf8"),
  ]);
  assert.match(i18n, /normalized\.startsWith\("it"\)/);
  assert.match(i18n, /if \(locale === "it"\) return "it-IT"/);
  assert.match(i18n, /translateEnglishToItalian\(translated\)/);
  assert.match(game, /<option value="it">IT<\/option>/);
  assert.match(lobby, /<option value="it">IT<\/option>/);
  assert.match(platform, /normalized\.startsWith\("it"\)/);

  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  globalThis.window = {
    location: { hostname: "games.crazygames.com", search: "" },
    CrazyGames: {
      SDK: {
        async init() {},
        game: { gameplayStart() {}, gameplayStop() {} },
        user: { systemInfo: { locale: "it-IT" } },
      },
    },
  };
  globalThis.document = { referrer: "https://www.crazygames.com/" };
  try {
    const adapter = await import(`../app/web-game-platform.ts?italian=${Date.now()}`);
    assert.equal((await adapter.getWebGameLaunchContext()).locale, "it");
  } finally {
    globalThis.window = previousWindow;
    globalThis.document = previousDocument;
  }
});
