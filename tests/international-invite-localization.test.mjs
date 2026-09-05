import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { translateEnglishToSpanish } from "../app/i18n-es.ts";
import { translateEnglishToFrench } from "../app/i18n-fr.ts";
import { translateEnglishToGerman } from "../app/i18n-de.ts";
import { translateEnglishToItalian } from "../app/i18n-it.ts";

test("keeps international invite surfaces out of the Chinese fallback branch", async () => {
  const files = [
    "../app/crew/crew-lobby.tsx",
    "../app/duel/duel-lobby.tsx",
    "../app/c/[code]/crew-room-client.tsx",
  ];
  const sources = await Promise.all(
    files.map((file) => readFile(new URL(file, import.meta.url), "utf8")),
  );
  for (const source of sources) {
    assert.doesNotMatch(source, /locale === "en"/);
    assert.match(source, /locale !== "zh"/);
    assert.match(source, /<Localized locale=\{locale\}>/);
  }
});

test("localizes dynamic crew invite status and share copy", () => {
  const translators = [
    translateEnglishToSpanish,
    translateEnglishToFrench,
    translateEnglishToGerman,
    translateEnglishToItalian,
  ];
  for (const translate of translators) {
    assert.notEqual(translate("Best 7"), "Best 7");
    assert.notEqual(translate("3 of 5 finished"), "3 of 5 finished");
    assert.notEqual(translate("Nudge 2 waiting →"), "Nudge 2 waiting →");
    assert.notEqual(
      translate("Keep our 4-day Blind Trading streak alive."),
      "Keep our 4-day Blind Trading streak alive.",
    );
  }
});
