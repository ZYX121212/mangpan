import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("exposes Quick Read as a bounded three-decision mode", async () => {
  const [lobby, page, sessions, api, client, activation, activationRoute] = await Promise.all([
    readFile(new URL("../app/mode-lobby.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/quick-read/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/challenge-sessions.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/challenge/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/game-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/activation-events.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/activation-events/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(lobby, /href: ".*quick-read"/);
  assert.match(lobby, /title: { en: "Quick Read"/);
  assert.match(lobby, /event: "lobby_mode_sprint"/);
  assert.match(activation, /\| "lobby_mode_sprint"/);
  assert.match(activationRoute, /"lobby_mode_sprint"/);
  assert.match(page, /<GameModePage mode="sprint"/);
  assert.match(page, /title: "Quick Read \| Blind Trading"/);
  assert.match(page, /canonical: "\/quick-read"/);
  assert.ok(sessions.includes('if (mode === "sprint") return 3'));
  assert.ok(sessions.includes("export async function startSprintSession"));
  assert.ok(sessions.includes('session.mode === "sprint"'));
  assert.ok(api.includes('params.get("mode") === "sprint"'));
  assert.ok(client.includes('const isQuickRead = gameMode === "sprint"'));
  assert.match(client, /Quick Read · 3 calls/);
});

test("exposes Endless as a separate long-cycle mode", async () => {
  const [lobby, page, client, sitemap] = await Promise.all([
    readFile(new URL("../app/mode-lobby.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/endless/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/game-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/sitemap.ts", import.meta.url), "utf8"),
  ]);
  assert.match(lobby, /href: "\/endless"/);
  assert.match(lobby, /title: \{ en: "Endless"/);
  assert.match(lobby, /event: "lobby_mode_endless"/);
  assert.match(page, /<GameModePage mode="endless"/);
  assert.match(page, /title: "Endless \| Blind Trading"/);
  assert.match(page, /canonical: "\/endless"/);
  assert.match(client, /isEndlessMode = gameMode === "endless"/);
  assert.match(client, /mangpan-endless-session/);
  assert.match(client, /BLIND TRADING ENDLESS/);
  assert.match(client, /SHARE YOUR LONG CYCLE/);
 assert.match(client, /longCycle: isEndlessMode/);
  assert.match(client, /"endless_start"/);
  assert.match(client, /"endless_complete"/);
  assert.match(client, /"endless_share"/);
  assert.match(client, /ENDLESS_MILESTONE_DAYS/);
  assert.match(client, /endless-milestone/);
  assert.match(sitemap, /"\/endless"/);
});
