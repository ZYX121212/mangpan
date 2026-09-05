import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("exposes Quick Read as a bounded three-decision mode", async () => {
  const [lobby, page, sessions, api, client] = await Promise.all([
    readFile(new URL("../app/mode-lobby.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/quick-read/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/challenge-sessions.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/challenge/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/game-client.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(lobby, /href: ".*quick-read"/);
  assert.match(lobby, /title: { en: "Quick Read"/);
  assert.match(lobby, /event: "lobby_mode_sprint"/);
  assert.match(page, /<GameModePage mode="sprint"/);
  assert.ok(sessions.includes('if (mode === "sprint") return 3'));
  assert.ok(sessions.includes("export async function startSprintSession"));
  assert.ok(sessions.includes('session.mode === "sprint"'));
  assert.ok(api.includes('params.get("mode") === "sprint"'));
  assert.ok(client.includes('const isQuickRead = initialMode === "sprint"'));
  assert.match(client, /Quick Read · 3 calls/);
});
