import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

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
