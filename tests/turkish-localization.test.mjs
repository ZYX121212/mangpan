import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { translateEnglishToTurkish } from "../app/i18n-tr.ts";

test("detects Turkish browsers and formats numbers for Turkey", async () => {
  const source = await readFile(new URL("../app/i18n.tsx", import.meta.url), "utf8");
  assert.match(source, /normalized\.startsWith\("tr"\)/);
  assert.match(source, /locale === "tr"\) return "tr-TR"/);
  assert.equal(translateEnglishToTurkish("Daily Challenge"), "Günlük Mücadele");
});

test("covers the Turkish first-play and sharing surfaces", async () => {
  for (const source of [
    "Can you read what happens next?",
    "Make one market call",
    "LONG CYCLE · NO CAP",
    "Start Practicing →",
    "Share Results",
    "Copy link",
    "Challenge sent",
  ]) {
    assert.notEqual(translateEnglishToTurkish(source), source, source);
  }
  assert.match(await readFile(new URL("../app/i18n.tsx", import.meta.url), "utf8"), /translateEnglishToTurkish/);
});
