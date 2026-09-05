import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("turns an Endless result share into a same-cycle friend challenge", async () => {
  const [modePage, endlessPage, client, events, apiEvents, manifest, styles] =
    await Promise.all([
      readFile(new URL("../app/game-mode-page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/endless/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/game-client.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/activation-events.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/api/activation-events/route.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/manifest.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    ]);

  assert.match(modePage, /targetDays\?: string/);
  assert.match(modePage, /boundedInteger\(params\?\.targetDays, 100_000\)/);
  assert.match(modePage, /initialEndlessTargetDays=/);
  assert.match(modePage, /initialEndlessTargetScore=/);
  assert.match(endlessPage, /targetScore\?: string/);
  assert.match(client, /params\.set\("targetDays", String\(Math\.max\(1, advancedDays\)\)\)/);
  assert.match(client, /params\.set\("targetScore", String\(skillScore\)\)/);
  assert.match(client, /Same hidden cycle\. Start from day one/);
  assert.match(client, /endless_challenge_view/);
  assert.match(client, /endless_challenge_start/);
  assert.match(events, /\| "endless_challenge_view"/);
  assert.match(apiEvents, /"endless_challenge_start"/);
  assert.match(manifest, /url: "\/endless\?market=us"/);
  assert.match(styles, /\.endless-challenge-target\{/);
});
