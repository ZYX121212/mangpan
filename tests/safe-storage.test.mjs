import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createSafeStorage } from "../app/safe-storage.ts";

test("falls back to in-memory progress when browser storage is blocked", () => {
  const storage = createSafeStorage(() => {
    throw new DOMException("Access denied", "SecurityError");
  });

  assert.equal(storage.isPersistent(), false);
  assert.equal(storage.getItem("session"), null);
  storage.setItem("session", "active");
  assert.equal(storage.getItem("session"), "active");
  storage.removeItem("session");
  assert.equal(storage.getItem("session"), null);
});

test("keeps the current tab playable after a later quota failure", () => {
  const values = new Map();
  let writes = 0;
  const storage = createSafeStorage(() => ({
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      writes += 1;
      if (writes > 2) throw new DOMException("Full", "QuotaExceededError");
      values.set(key, value);
    },
    removeItem: (key) => values.delete(key),
  }));

  assert.equal(storage.isPersistent(), true);
  storage.setItem("locale", "es");
  storage.setItem("session", "live");
  assert.equal(storage.getItem("session"), "live");
  assert.equal(storage.isPersistent(), false);
});

test("uses persistent storage when it is available", () => {
  const values = new Map();
  const storage = createSafeStorage(() => ({
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  }));

  storage.setItem("player", "reader-1");
  assert.equal(storage.isPersistent(), true);
  assert.equal(storage.getItem("player"), "reader-1");
});

test("routes every gameplay persistence call through the resilient layer", async () => {
  const files = [
    "../app/game-client.tsx",
    "../app/mode-lobby.tsx",
    "../app/crew/crew-lobby.tsx",
    "../app/duel/duel-lobby.tsx",
    "../app/duel/create/quick-duel-client.tsx",
    "../app/c/[code]/crew-room-client.tsx",
  ];
  const sources = await Promise.all(
    files.map((file) => readFile(new URL(file, import.meta.url), "utf8")),
  );

  for (const source of sources) {
    assert.doesNotMatch(source, /\blocalStorage\./);
  }
  assert.match(sources[0], /storage-fallback-banner/);
  assert.match(sources[0], /safeLocalStorage\.isPersistent\(\)/);
});
