import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("contains the complete blind chart game shell", async () => {
  const [page, layout, i18n] = await Promise.all([
    readFile(new URL("../app/game-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/i18n.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(layout, /Blind Trading \| Real Historical Market Challenge/);
  assert.match(layout, /<html lang="en">/);
  assert.match(page, /今日盲盘/);
  assert.match(page, /竞技榜/);
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
  assert.match(page, /无限练习/);
  assert.match(page, /深度分析我的画像/);
  assert.match(page, /决策契约/);
  assert.match(page, /推进前锁定/);
  assert.match(page, /记录本次后续走势观点/);
  assert.match(page, /概率越激进，判断错误时校准损失越大/);
  assert.match(page, /概率校准/);
  assert.match(page, /每日 5 决策/);
  assert.match(page, /DAILY MARKET MYSTERY/);
  assert.match(page, /全球玩家同一张神秘图/);
  assert.match(page, /GLOBAL CROWD/);
  assert.match(page, /crowd-consensus/);
  assert.match(page, /advanced\.crowdForecast/);
  assert.match(page, /Choose one way to play/);
  assert.match(page, /Daily Challenge/);
  assert.match(page, /Endless Practice/);
  assert.match(page, /Training Lab/);
  assert.match(page, /Friend Duel/);
  assert.match(page, /mode-card-grid/);
  assert.match(page, /duelJoinInput/);
  assert.match(page, /chooseMode\("daily"\)/);
  assert.match(page, /chooseMode\("practice"\)/);
  assert.match(page, /chooseMode\("training"\)/);
  assert.match(page, /nextDailyCountdown/);
  assert.match(page, /NEXT DAILY MYSTERY/);
  assert.match(page, /7-DAY TARGET/);
  assert.match(page, /daily-return-loop/);
  assert.match(page, /mode-daily-status/);
  assert.match(page, /createResultShareCard/);
  assert.match(page, /navigator\.canShare/);
  assert.match(page, /duel-comparison/);
  assert.match(page, /换一只股票 →/);
  assert.match(page, /更换股票将结束今日挑战并转入随机练习/);
  assert.doesNotMatch(page, /离开今日挑战 · 随机练习/);
  assert.match(page, /window\.confirm/);
  assert.match(page, /method: "DELETE"/);
  assert.match(page, /12 课训练树/);
  assert.match(page, /训练通关/);
  assert.match(page, /情景复盘/);
  assert.match(page, /上次记录观点 · 第 \{lastFeedback\.round\} 次推进/);
  assert.match(page, /最大有利/);
  assert.match(page, /逐次决策证据/);
  assert.match(page, /feedbackHistory/);
  assert.match(page, /PROCESS SCORE · 过程能力/);
  assert.match(page, /系统推荐下一局/);
  assert.match(page, /已恢复云端进度/);
  assert.match(page, /云端训练档案/);
  assert.match(page, /PATTERN QUIZ · 形态识别盲测/);
  assert.match(page, /真实成本模型/);
  assert.match(page, /交易税费/);
  assert.match(page, /DAILY ROUTINE · 今日训练/);
  assert.match(page, /全部完成 \+60 XP/);
  assert.match(page, /错题重练/);
  assert.match(page, /先过标准/);
  assert.match(page, /本周联赛/);
  assert.match(page, /每周取个人最佳 5 局/);
  assert.match(page, /匿名挑战码/);
  assert.match(page, /DECISION REPLAY · 决策时间线/);
  assert.match(page, /未记录方向观点 · 本次不参与判断评分/);
  assert.match(page, /item\.matched == null/);
  assert.match(page, /继续查看后续/);
  assert.match(page, /ACHIEVEMENT WALL · 云端成就/);
  assert.match(page, /已解锁 \{scoreboard\.stats\.unlockedAchievements\}\/10/);
  assert.match(page, /WEEKLY OBJECTIVES · 周目标/);
  assert.match(page, /全部完成 \+120 XP/);
  assert.match(page, /单局最佳收益/);
  assert.match(page, /mangpan-active-session-/);
  assert.match(page, /mangpan-scenario-progress/);
  assert.match(page, /四维诊断/);
  assert.match(page, /完整数据：/);
  assert.match(page, /stock\.candles\.length\.toLocaleString/);
  assert.match(page, /mangpan-locale/);
  assert.match(page, /changeLocale\("en"\)/);
  assert.match(page, /useState<Locale>\("en"\)/);
  assert.match(page, /useState<MarketKind>\(initialChallenge\.market\)/);
  assert.match(page, /document\.documentElement\.lang/);
  assert.match(i18n, /Blind Trading \| Real Historical Market Challenge/);
  assert.match(i18n, /Decision Contract/);
  assert.doesNotMatch(page, /最多推进 60/);
  assert.doesNotMatch(page, /Building your site|Your site is taking shape/);
});

test("keeps ranking authoritative and identity hidden until settlement", async () => {
  const [
    page,
    pageRoute,
    scoreRoute,
    challengeRoute,
    quizRoute,
    duelRoute,
    identity,
    sessions,
    schema,
    hosting,
    styles,
    config,
    core,
    challengeService,
    universe,
    marketData,
    analysis,
    migration,
    quizMigration,
    sessionIndexMigration,
    dailyProgressMigration,
    duelMigration,
    weeklyRewardMigration,
  ] = await Promise.all([
    readFile(new URL("../app/game-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/scores/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/challenge/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/quiz/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/duels/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/request-identity.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/challenge-sessions.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/game-config.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/game-core.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/challenge-service.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/cn-stock-universe.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/market-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/trade-analysis.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../drizzle/0004_little_puff_adder.sql", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../drizzle/0005_square_dust.sql", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../drizzle/0006_red_bloodaxe.sql", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../drizzle/0007_silent_umar.sql", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../drizzle/0008_warm_old_lace.sql", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../drizzle/0009_reflective_madripoor.sql", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(page, /ticker-mask/);
  assert.match(page, /market-tooltip/);
  assert.match(page, /成交量/);
  assert.match(page, /hoverAmplitude/);
  assert.match(page, /发起好友同图挑战/);
  assert.match(page, /fetch\("\/api\/duels"/);
  assert.doesNotMatch(page, /encodeURIComponent\(playerId\).*duel/);
  assert.match(page, /localStorage\.getItem\("mangpan-player-id"\)/);
  assert.match(
    scoreRoute,
    /getSessionForScore\(payload\.sessionId, playerId\)/,
  );
  assert.match(
    scoreRoute,
    /replayChallenge\([\s\S]*challenge\.bundle\.stock,[\s\S]*challenge\.actions,[\s\S]*market/,
  );
  assert.match(scoreRoute, /scoreDate\(date, market\)/);
  assert.match(scoreRoute, /onConflictDoNothing/);
  assert.doesNotMatch(scoreRoute, /payload\.actions/);
  assert.match(pageRoute, /startDailySession/);
  assert.doesNotMatch(pageRoute, /getDailyChallengeBundle/);
  assert.match(challengeRoute, /advanceSession/);
  assert.match(challengeRoute, /revealSession/);
  assert.match(challengeRoute, /resumeSession/);
  assert.match(challengeRoute, /requestPlayerId/);
  assert.match(challengeRoute, /resumeLatestSession/);
  assert.match(challengeRoute, /export async function DELETE/);
  assert.match(challengeRoute, /abandonSession/);
  assert.match(challengeRoute, /difficultyFrom/);
  assert.match(quizRoute, /answerPatternQuiz/);
  assert.match(quizRoute, /getTrainingProfile/);
  assert.match(duelRoute, /完成并提交今日挑战后才可发起同图对决/);
  assert.match(duelRoute, /crypto\.randomUUID/);
  assert.match(scoreRoute, /buildWeeklyLeague/);
  assert.match(scoreRoute, /ROW_NUMBER\(\) OVER/);
  assert.match(scoreRoute, /每周取最佳 5 局/);
  assert.match(scoreRoute, /duelChallenges/);
  assert.match(scoreRoute, /buildAchievements/);
  assert.match(scoreRoute, /weeklyRewards/);
  assert.match(scoreRoute, /lifetimeRewardXp/);
  assert.match(scoreRoute, /achievementXp/);
  assert.match(scoreRoute, /\.limit\(120\)/);
  assert.match(scoreRoute, /FROM daily_scores INDEXED BY daily_scores_player_history_idx/);
  assert.match(identity, /oai-authenticated-user-id/);
  assert.match(identity, /crypto\.subtle\.digest/);
  assert.match(sessions, /maskCandle/);
  assert.match(sessions, /const hasAnyView/);
  assert.match(sessions, /isProbabilityForecast/);
  assert.match(sessions, /probabilities \? \{ probabilities \} : \{\}/);
  assert.match(sessions, /交易指令无效，请检查委托内容/);
  assert.doesNotMatch(sessions, /请完整记录方向、依据和信心/);
  assert.match(schema, /game_sessions/);
  assert.match(schema, /trainingResults/);
  assert.match(schema, /trainingProgress/);
  assert.match(schema, /patternQuizzes/);
  assert.match(schema, /dailyProgress/);
  assert.match(schema, /duelChallenges/);
  assert.match(schema, /weeklyRewards/);
  assert.match(schema, /daily_scores_date_player_unique/);
  assert.match(hosting, /"d1": "DB"/);
  assert.match(styles, /\.rules-modal li span\{[^}]*grid-column:2/);
  assert.match(styles, /Desktop trading terminal/);
  assert.match(styles, /\.shell\{height:100dvh;min-height:0/);
  assert.match(styles, /\.workspace\{min-height:0;flex:1/);
  assert.match(styles, /\.trade-panel>\*\{flex-shrink:0\}/);
  assert.match(styles, /\.probability-contract\{flex:0 0 auto\}/);
  assert.match(
    styles,
    /\.probability-contract \.journal-row\{grid-template-columns:1fr\}/,
  );
  assert.match(config, /ORDER_ALLOCATIONS = \[0\.25, 1 \/ 3, 0\.5, 0\.75, 1\]/);
  assert.match(config, /market === "cn" \? 100 : 1/);
  assert.match(config, /daily-comeback-v13/);
  assert.match(config, /DAILY_CHALLENGE_DECISIONS = 5/);
  assert.match(config, /transactionQuote/);
  assert.match(config, /gross \* 0\.0005/);
  assert.match(config, /gross \* 0\.0000206/);
  assert.match(sessions, /actions\.length >= DAILY_CHALLENGE_DECISIONS/);
  assert.match(sessions, /nextActions\.length >= DAILY_CHALLENGE_DECISIONS/);
  assert.match(sessions, /getCrowdForecast/);
  assert.match(sessions, /LIMIT 500/);
  assert.match(sessions, /forecastForAction/);
  assert.match(sessions, /actions\.length < DAILY_CHALLENGE_DECISIONS/);
  assert.match(sessions, /actions\.length !== DAILY_CHALLENGE_DECISIONS/);
  assert.match(config, /initialBarsFor/);
  assert.match(core, /orderQuantity\(\{[\s\S]*kind: "buy"/);
  assert.match(challengeService, /dailyChallenges/);
  assert.match(challengeService, /onConflictDoNothing/);
  assert.match(marketData, /MIN_GAME_BARS/);
  assert.match(marketData, /windowEnds/);
  assert.match(marketData, /Promise\.all/);
  assert.match(marketData, /candlesByDate/);
  assert.match(marketData, /initialVisibleCount: decisionIndex/);
  assert.match(marketData, /scenarioFutureBars/);
  assert.match(marketData, /ScenarioDifficulty/);
  assert.doesNotMatch(marketData, /candles\.slice\(start\)/);
  assert.doesNotMatch(marketData, /historicalEnd/);
  assert.doesNotMatch(marketData, /TOTAL_BARS/);
  assert.match(
    core,
    /availableDays = Math\.max\(0, candles\.length - initialBars\)/,
  );
  assert.match(core, /calibrationScore/);
  assert.match(core, /riskScore \* 0\.3/);
  assert.match(core, /calibrationScore \* 0\.3/);
  assert.match(core, /executionScore \* 0\.1/);
  assert.match(core, /disciplineScore \* 0\.25/);
  assert.match(core, /performanceScore \* 0\.05/);
  assert.match(core, /feesPaid/);
  assert.match(sessions, /recordTrainingResult/);
  assert.match(sessions, /getTrainingProfile/);
  assert.match(sessions, /recordDailyActivity/);
  assert.match(sessions, /abandoned_daily/);
  assert.match(sessions, /abandoned_practice/);
  assert.match(sessions, /return \{ abandoned: true \}/);
  assert.match(sessions, /loaded\.session\.mode !== "daily"/);
  assert.match(sessions, /今日挑战已放弃，不能提交排行榜成绩/);
  assert.match(sessions, /weakestRecognition/);
  assert.match(sessions, /该挑战属于另一位玩家/);
  assert.match(migration, /CREATE TABLE `training_results`/);
  assert.match(migration, /ALTER TABLE `game_sessions` ADD `scenario`/);
  assert.match(quizMigration, /CREATE TABLE `pattern_quizzes`/);
  assert.match(
    sessionIndexMigration,
    /game_sessions_player_active_idx/,
  );
  assert.match(dailyProgressMigration, /CREATE TABLE `daily_progress`/);
  assert.match(duelMigration, /CREATE TABLE `duel_challenges`/);
  assert.match(duelMigration, /duel_challenges_player_date_market_unique/);
  assert.match(weeklyRewardMigration, /CREATE TABLE `weekly_rewards`/);
  assert.match(weeklyRewardMigration, /weekly_rewards_player_market_week_unique/);
  assert.match(analysis, /平均仓位/);
  assert.match(analysis, /trainingGoal/);
  assert.equal((universe.match(/\\"code\\":\\"\d{6}\\"/g) ?? []).length, 5550);
});
