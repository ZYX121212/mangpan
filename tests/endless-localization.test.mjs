import assert from "node:assert/strict";
import test from "node:test";
import { translateEnglishToSpanish } from "../app/i18n-es.ts";
import { translateEnglishToFrench } from "../app/i18n-fr.ts";
import { translateEnglishToGerman } from "../app/i18n-de.ts";
import { translateEnglishToItalian } from "../app/i18n-it.ts";

const HAN = /[\u3400-\u9fff]/u;

test("localizes the Endless mode promise across every overseas launch locale", () => {
  const criticalCopy = [
    "LONG CYCLE · NO CAP",
    "Endless",
    "Stay with one real historical cycle for as long as you want. Pause, return, and build a deeper decision record without a leaderboard.",
    "Long history · save and resume",
    "Enter the long cycle",
    "One long historical cycle · keep reading until the end",
    "Endless milestone progress",
    "All milestones reached",
    "START ANOTHER LONG CYCLE",
    "SHARE YOUR LONG CYCLE",
  ];
  const translators = [
    translateEnglishToSpanish,
    translateEnglishToFrench,
    translateEnglishToGerman,
    translateEnglishToItalian,
  ];

  for (const translate of translators) {
    for (const source of criticalCopy) {
      const translated = translate(source);
      assert.notEqual(translated, source, source);
      assert.doesNotMatch(translated, HAN, source);
    }
  }
});

test("localizes dynamic Endless milestone labels without leaking Chinese", () => {
  const labels = [
    "Next milestone · 60d",
    "All milestones reached",
    "Endless · Long cycle · 60 trading days",
  ];
  const translators = [
    translateEnglishToSpanish,
    translateEnglishToFrench,
    translateEnglishToGerman,
    translateEnglishToItalian,
  ];
  for (const translate of translators)
    for (const label of labels) assert.doesNotMatch(translate(label), HAN);
});
