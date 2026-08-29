import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("contains the complete blind chart game shell", async () => {
  const [page, layout] = await Promise.all([
    readFile(new URL("../app/game-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(layout, /盲盘｜真实历史 K 线交易挑战/);
  assert.match(page, /今日盲盘/);
  assert.match(page, /今日排行/);
  assert.match(page, /可缩放、拖动和键盘操作的真实历史日K线图/);
  assert.match(page, /向左查看更早K线/);
  assert.match(page, /向右查看更新K线/);
  assert.match(page, /定位K线历史位置/);
  assert.match(page, /onPointerDown/);
  assert.match(page, /touchPointsRef/);
  assert.match(page, /Math\.hypot/);
  assert.match(page, /onDoubleClick=\{resetView\}/);
  assert.match(page, /event\.key === "ArrowLeft"/);
  assert.match(page, /event\.shiftKey/);
  assert.match(page, /或按股数委托/);
  assert.match(page, /减少 \$\{lotSize\} 股/);
  assert.match(page, /增加 \$\{lotSize\} 股/);
  assert.match(page, /adjustQuantity\(-1\)/);
  assert.match(page, /adjustQuantity\(1\)/);
  assert.match(page, /"1\/4"/);
  assert.match(page, /"1\/3"/);
  assert.match(page, /"3\/4"/);
  assert.match(page, /"全仓"/);
  assert.match(page, /只全市场股票池/);
  assert.match(page, /选择持有交易日数/);
  assert.match(page, /选择股票市场/);
  assert.match(page, /无固定期限/);
  assert.match(page, /深度分析我的画像/);
  assert.match(page, /四维诊断/);
  assert.match(page, /完整数据：/);
  assert.match(page, /stock\.candles\.length\.toLocaleString/);
  assert.doesNotMatch(page, /最多推进 60/);
  assert.doesNotMatch(page, /Building your site|Your site is taking shape/);
});

test("keeps ranking authoritative and identity hidden until settlement", async () => {
  const [page, route, schema, hosting, styles, config, core, challengeService, universe, marketData, analysis] = await Promise.all([
    readFile(new URL("../app/game-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/scores/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/game-config.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/game-core.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/challenge-service.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/cn-stock-universe.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/market-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/trade-analysis.ts", import.meta.url), "utf8"),
  ]);

  assert.match(page, /ticker-mask/);
  assert.match(page, /market-tooltip/);
  assert.match(page, /成交量/);
  assert.match(page, /hoverAmplitude/);
  assert.match(page, /发起好友同图挑战/);
  assert.match(page, /localStorage\.getItem\("mangpan-player-id"\)/);
  assert.match(route, /replayChallenge\(challenge\.stock, payload\.actions, market\)/);
  assert.match(route, /scoreDate\(date, market\)/);
  assert.match(route, /onConflictDoNothing/);
  assert.match(schema, /daily_scores_date_player_unique/);
  assert.match(hosting, /"d1": "DB"/);
  assert.match(styles, /\.rules-modal li span\{[^}]*grid-column:2/);
  assert.match(styles, /Desktop trading terminal/);
  assert.match(styles, /\.shell\{height:100dvh;min-height:0/);
  assert.match(styles, /\.workspace\{min-height:0;flex:1/);
  assert.match(config, /ORDER_ALLOCATIONS = \[0\.25, 1 \/ 3, 0\.5, 0\.75, 1\]/);
  assert.match(config, /market === "cn" \? 100 : 1/);
  assert.match(config, /full-history-v3/);
  assert.match(config, /initialBarsFor/);
  assert.match(core, /orderQuantity\(\{ market, kind: "buy"/);
  assert.match(challengeService, /dailyChallenges/);
  assert.match(challengeService, /onConflictDoNothing/);
  assert.match(marketData, /MIN_GAME_BARS/);
  assert.match(marketData, /windowEnds/);
  assert.match(marketData, /Promise\.all/);
  assert.match(marketData, /candlesByDate/);
  assert.match(marketData, /initialVisibleCount: decisionIndex/);
  assert.doesNotMatch(marketData, /candles\.slice\(start\)/);
  assert.doesNotMatch(marketData, /historicalEnd/);
  assert.doesNotMatch(marketData, /TOTAL_BARS/);
  assert.match(core, /availableDays = Math\.max\(0, candles\.length - initialBars\)/);
  assert.match(analysis, /平均仓位/);
  assert.match(analysis, /trainingGoal/);
  assert.equal((universe.match(/\\"code\\":\\"\d{6}\\"/g) ?? []).length, 5550);
});
