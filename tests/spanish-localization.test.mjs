import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { translateEnglishToSpanish } from "../app/i18n-es.ts";

const HAN = /[\u3400-\u9fff]/u;

test("translates the Spanish first-play promise and guided loop", () => {
  const criticalCopy = [
    "Can you read what happens next?",
    "Make one forecast on a hidden piece of real market history, then reveal the answer. Learn the complete loop by playing—not by reading a tutorial.",
    "Read the chart, then make one forecast",
    "Choose an action and reveal three real days",
    "That is the whole loop",
    "Play today's global challenge →",
  ];

  for (const source of criticalCopy) {
    const translated = translateEnglishToSpanish(source);
    assert.notEqual(translated, source);
    assert.doesNotMatch(translated, HAN);
  }
});

test("translates all five separated modes and dynamic decision labels", () => {
  for (const mode of [
    "Daily Challenge",
    "Market Run",
    "Training Lab",
    "Friend Duel",
    "Crew Streak",
  ]) {
    assert.notEqual(translateEnglishToSpanish(mode), mode);
  }
  assert.equal(
    translateEnglishToSpanish("Market 2/5 · Decision 3/5 · 12 trading days"),
    "Mercado 2/5 · Decisión 3/5 · 12 días de mercado",
  );
});

test("connects Spanish browser detection, controls, and recursive localization", async () => {
  const [i18n, game, lobby, platform, crew, duel] = await Promise.all([
    readFile(new URL("../app/i18n.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/game-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/mode-lobby.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/web-game-platform.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/crew/crew-lobby.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/duel/duel-lobby.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(i18n, /export type Locale = "zh" \| "en" \| "es" \| "fr" \| "de"/);
  assert.match(i18n, /normalized\.startsWith\("es"\)/);
  assert.match(i18n, /if \(locale === "es"\) return "es-ES"/);
  assert.match(i18n, /Children\.map\(element\.props\.children/);
  assert.doesNotMatch(i18n, /if \(typeof element\.type !== "string"\) return node/);

  assert.match(game, /navigator\.languages\?\.\[0\]/);
  assert.match(game, /<option value="es">ES<\/option>/);
  assert.match(game, /localeNumberTag\(locale\)/);
  assert.match(game, /marketRunStage\.title\[copyLocale\]/);
  assert.match(lobby, /<option value="es">ES<\/option>/);
  assert.match(lobby, /<Localized locale=\{locale\}>/);
  assert.match(platform, /normalized\.startsWith\("es"\)/);
  assert.match(crew, /normalizeLocale/);
  assert.match(crew, /<Localized locale=\{locale\}>/);
  assert.match(duel, /normalizeLocale/);
  assert.match(duel, /<Localized locale=\{locale\}>/);
});
