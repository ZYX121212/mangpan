import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { translateEnglishToFrench } from "../app/i18n-fr.ts";

const HAN = /[\u3400-\u9fff]/u;

test("translates the complete French first-play promise and guided loop", () => {
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
    const translated = translateEnglishToFrench(source);
    assert.notEqual(translated, source);
    assert.doesNotMatch(translated, HAN);
  }
});

test("translates all five separated modes and dynamic French labels", () => {
  for (const mode of [
    "Daily Challenge",
    "Market Run",
    "Training Lab",
    "Friend Duel",
    "Crew Streak",
  ]) {
    assert.notEqual(translateEnglishToFrench(mode), mode);
  }
  assert.equal(
    translateEnglishToFrench("Market 2/5 · Decision 3/5 · 12 trading days"),
    "Marché 2/5 · Décision 3/5 · 12 jours de bourse",
  );
});

test("keeps French coverage in parity with the established Spanish pack", async () => {
  const [spanish, french] = await Promise.all([
    readFile(new URL("../app/i18n-es.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/i18n-fr.ts", import.meta.url), "utf8"),
  ]);
  const keys = (source) =>
    [...source.matchAll(/^ {2}"([^"]+)":/gm)].map((match) => match[1]).sort();

  assert.deepEqual(keys(french), keys(spanish));
  assert.ok(keys(french).length >= 280);
});

test("connects French browser detection, compact controls, and number formats", async () => {
  const [i18n, game, lobby, platform, styles] = await Promise.all([
    readFile(new URL("../app/i18n.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/game-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/mode-lobby.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/web-game-platform.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(i18n, /normalized\.startsWith\("fr"\)/);
  assert.match(i18n, /if \(locale === "fr"\) return "fr-FR"/);
  assert.match(i18n, /translateEnglishToFrench\(translated\)/);
  assert.match(game, /<option value="fr">FR<\/option>/);
  assert.match(game, /Trading à l’aveugle/);
  assert.match(lobby, /<option value="fr">FR<\/option>/);
  assert.match(platform, /normalized\.startsWith\("fr"\)/);
  assert.match(styles, /\.game-language-select\{width:55px/);
  assert.doesNotMatch(styles, /\.language-toggle/);
});

test("reads a French portal locale for the international first-play path", async () => {
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  globalThis.window = {
    location: { hostname: "games.crazygames.com", search: "" },
    CrazyGames: {
      SDK: {
        async init() {},
        game: { gameplayStart() {}, gameplayStop() {} },
        user: { systemInfo: { locale: "fr-FR" } },
      },
    },
  };
  globalThis.document = { referrer: "https://www.crazygames.com/" };
  try {
    const adapter = await import(
      `../app/web-game-platform.ts?crazy-french=${Date.now()}`
    );
    assert.equal((await adapter.getWebGameLaunchContext()).locale, "fr");
  } finally {
    globalThis.window = previousWindow;
    globalThis.document = previousDocument;
  }
});
