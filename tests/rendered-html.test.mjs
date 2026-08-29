import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the blind chart game shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>盲盘｜真实历史 K 线交易挑战<\/title>/);
  assert.match(html, /今日盲盘/);
  assert.match(html, /今日排行/);
  assert.match(html, /可缩放的真实历史日K线图/);
  assert.match(html, /市价买入 .* 股 · 推进 3 天/);
  assert.match(html, /或按股数委托/);
  assert.match(html, />1\/4</);
  assert.match(html, />1\/3</);
  assert.match(html, />3\/4</);
  assert.match(html, />全仓</);
  assert.match(html, /已推进 .*0.*60.*个交易日/);
  assert.match(html, /选择持有交易日数/);
  assert.match(html, /选择股票市场/);
  assert.match(html, />A股</);
  assert.match(html, />美股</);
  assert.doesNotMatch(html, /Building your site|Your site is taking shape/);
});

test("keeps ranking authoritative and identity hidden until settlement", async () => {
  const [page, route, schema, hosting, styles, config, core] = await Promise.all([
    readFile(new URL("../app/game-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/scores/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/game-config.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/game-core.ts", import.meta.url), "utf8"),
  ]);

  assert.match(page, /ticker-mask/);
  assert.match(page, /market-tooltip/);
  assert.match(page, /成交量/);
  assert.match(page, /hoverAmplitude/);
  assert.match(page, /发起好友同图挑战/);
  assert.match(page, /localStorage\.getItem\("mangpan-player-id"\)/);
  assert.match(route, /replayChallenge\(date, payload\.actions, market\)/);
  assert.match(route, /scoreDate\(date, market\)/);
  assert.match(route, /onConflictDoNothing/);
  assert.match(schema, /daily_scores_date_player_unique/);
  assert.match(hosting, /"d1": "DB"/);
  assert.match(styles, /\.rules-modal li span\{[^}]*grid-column:2/);
  assert.match(config, /ORDER_ALLOCATIONS = \[0\.25, 1 \/ 3, 0\.5, 0\.75, 1\]/);
  assert.match(config, /market === "cn" \? 100 : 1/);
  assert.match(core, /orderQuantity\(\{ market, kind: "buy"/);
});
