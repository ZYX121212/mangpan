import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const HAN = /[\u3400-\u9fff]/u;

function parseSource(name, source) {
  return ts.createSourceFile(
    name,
    source,
    ts.ScriptTarget.Latest,
    true,
    name.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

function staticText(node, sourceFile) {
  if (ts.isStringLiteralLike(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  if (ts.isJsxText(node)) return node.getText(sourceFile).trim();
  return null;
}

function isInsideLocaleConditional(node, sourceFile) {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (
      ts.isConditionalExpression(parent) &&
      parent.condition.getText(sourceFile).includes("locale")
    ) {
      return true;
    }
  }
  return false;
}

test("contains the complete blind chart game shell", async () => {
  const [page, layout, i18n] = await Promise.all([
    readFile(new URL("../app/game-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/i18n.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(layout, /Blind Trading \| Real Historical Market Challenge/);
  assert.match(layout, /Blind Trading \| Can You Read the Market Better\?/);
  assert.match(layout, /Challenge friends on the exact same market/);
  assert.match(layout, /images: \["\/og\.png"\]/);
  assert.match(layout, /manifest: "\/manifest\.webmanifest"/);
  assert.match(layout, /\/icons\/favicon-32\.png/);
  assert.match(layout, /\/icons\/apple-touch-icon\.png/);
  assert.match(layout, /themeColor: "#252721"/);
  assert.match(layout, /<html lang="en">/);
  assert.match(page, /今日盲盘/);
  assert.match(page, /竞技榜/);
  assert.match(page, /可缩放、拖动和键盘操作的真实历史日K线图/);
  assert.match(page, /向左查看更早K线/);
  assert.match(page, /向右查看更新K线/);
  assert.match(page, /定位K线历史位置/);
  assert.match(page, /MARKET_COLORS\[market\]/);
  assert.match(page, /color = up \? upColor : downColor/);
  assert.match(page, /color = buy \? buyColor : sellColor/);
  assert.match(
    page,
    /<main className="shell" data-market=\{market\} data-game-mode=\{gameMode\}>/,
  );
  assert.match(page, /DAILY_ORDER_ALLOCATIONS = \[\s*0\.25,\s*0\.5,\s*1,/);
  assert.match(page, /gameMode !== "daily" && \(/);
  assert.match(page, /daily-quick-contract/);
  assert.match(page, /forecastTouched/);
  assert.match(page, /Required before every reveal/);
  assert.match(page, /Choose your forecast first/);
  assert.match(page, /Next 3 trading days/);
  assert.match(page, /market-color-key/);
  assert.match(page, /const historicalDuel = Boolean/);
  assert.match(page, /session\.date !== currentMarketDate && !initialDuel/);
  assert.match(page, /Room rank #/);
  assert.match(page, /First attempt locked/);
  assert.match(page, /Archived friend duel/);
  assert.match(page, /market colors: up and buy are/);
  assert.match(page, /market-up-swatch/);
  assert.match(page, /market-down-swatch/);
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
  assert.match(page, /mangpan-guided-first-chart-v1/);
  assert.match(page, /useState\(false\)/);
  assert.match(page, /mangpan-active-session-us/);
  assert.match(page, /60-SECOND GUIDED RUN/);
  assert.match(page, /guided-start-card/);
  assert.match(page, /startGuidedChart/);
  assert.match(page, /await chooseMode\("practice"\)/);
  assert.match(page, /GUIDED FIRST CHART · STEP/);
  assert.match(page, /onboardingStep === 1/);
  assert.match(page, /onboardingStep === 2/);
  assert.match(page, /setOnboardingStep\(3\)/);
  assert.match(page, /scrollIntoView/);
  assert.match(page, /enterDailyAfterGuide/);
  assert.match(page, /Play today's global challenge/);
  assert.match(page, /duelJoinInput/);
  assert.match(page, /chooseMode\("daily"\)/);
  assert.match(page, /chooseMode\("practice"\)/);
  assert.match(page, /chooseMode\("training"\)/);
  assert.match(page, /marketCountdown\(initialChallenge\.market\)/);
  assert.match(page, /marketCountdown\(market\)/);
  assert.match(page, /marketDate\(market\)/);
  assert.match(page, /dailyExpired/);
  assert.match(page, /daily-refresh-banner/);
  assert.match(page, /NEW YORK MIDNIGHT/);
  assert.match(page, /SHANGHAI MIDNIGHT/);
  assert.match(page, /NEXT DAILY MYSTERY/);
  assert.match(page, /7-DAY TARGET/);
  assert.match(page, /daily-return-loop/);
  assert.match(page, /career-freeze-card/);
  assert.match(page, /STREAK PROTECTION/);
  assert.match(page, /STREAK SAVED/);
  assert.match(page, /FREEZE EARNED/);
  assert.match(page, /streakProtection\.nextFreezeIn/);
  assert.match(page, /beforeinstallprompt/);
  assert.match(page, /appinstalled/);
  assert.match(page, /installGame/);
  assert.match(page, /install-return-card/);
  assert.match(page, /KEEP YOUR STREAK CLOSE/);
  assert.match(page, /Add to home screen/);
  assert.match(page, /mode-daily-status/);
  assert.match(page, /YOU VS THE CROWD/);
  assert.match(page, /crowd-result-card/);
  assert.match(page, /crowdComparison\.beatCrowd/);
  assert.match(page, /crowd-replay-note/);
  assert.match(page, /Crowd edge/);
  assert.match(page, /createResultShareCard/);
  assert.match(page, /navigator\.share/);
  assert.match(page, /saveResultCard/);
  assert.match(page, /ClipboardItem/);
  assert.match(page, /URL\.createObjectURL/);
  assert.match(page, /resultShareMarks/);
  assert.match(page, /result-share-kit/);
  assert.match(page, /SHARE WITHOUT SPOILERS/);
  assert.match(page, /prepareDuelShareUrl/);
  assert.match(page, /shareSetupStatus/);
  assert.match(page, /result-share-channels/);
  assert.match(page, /taggedChallengeUrl/);
  assert.match(page, /Challenge ready · tap again to share/);
  assert.match(page, /YOUR DUEL ROOM/);
  assert.match(page, /shareDuelRoom/);
  assert.match(page, /duelRoomShareStatus/);
  assert.match(page, /Share this duel again/);
  assert.match(page, /duel-comparison/);
  assert.match(page, /PRIVATE SAME-CHART DUEL/);
  assert.match(page, /duel-invite-card/);
  assert.match(page, /SCORE TO BEAT/);
  assert.match(page, /Their trades, returns, and the ticker stay hidden until you finish/);
  assert.match(page, /scoreboard\.opponent\.score/);
  assert.match(page, /leaveDuel/);
  assert.match(page, /Send result back to/);
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

test("ships an installable, branded web app manifest", async () => {
  const [manifest, styles, icon192, icon512, appleIcon, favicon] =
    await Promise.all([
      readFile(new URL("../app/manifest.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
      readFile(new URL("../public/icons/icon-192.png", import.meta.url)),
      readFile(new URL("../public/icons/icon-512.png", import.meta.url)),
      readFile(
        new URL("../public/icons/apple-touch-icon.png", import.meta.url),
      ),
      readFile(new URL("../public/icons/favicon-32.png", import.meta.url)),
    ]);

  assert.match(manifest, /name: "Blind Trading — Daily Market Challenge"/);
  assert.match(manifest, /short_name: "Blind Trade"/);
  assert.match(manifest, /start_url: "\/"/);
  assert.match(manifest, /display: "standalone"/);
  assert.match(manifest, /background_color: "#f7f5f0"/);
  assert.match(manifest, /theme_color: "#252721"/);
  assert.match(manifest, /\/icons\/icon-192\.png/);
  assert.match(manifest, /\/icons\/icon-512\.png/);
  assert.match(manifest, /purpose: "any maskable"/);
  assert.match(styles, /\.install-return-card/);
  assert.match(styles, /\.install-app-mark/);

  for (const [icon, size] of [
    [icon192, 192],
    [icon512, 512],
    [appleIcon, 180],
    [favicon, 32],
  ]) {
    assert.equal(icon.subarray(1, 4).toString(), "PNG");
    assert.equal(icon.readUInt32BE(16), size);
    assert.equal(icon.readUInt32BE(20), size);
  }
});

test("keeps the English launch surface free of uncovered static Chinese copy", async () => {
  const [page, i18n, analysis] = await Promise.all([
    readFile(new URL("../app/game-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/i18n.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/trade-analysis.ts", import.meta.url), "utf8"),
  ]);

  const i18nFile = parseSource("i18n.tsx", i18n);
  const dictionary = new Map();
  function findDictionary(node) {
    if (
      ts.isVariableDeclaration(node) &&
      node.name.getText(i18nFile) === "ENGLISH" &&
      ts.isObjectLiteralExpression(node.initializer)
    ) {
      for (const property of node.initializer.properties) {
        if (
          ts.isPropertyAssignment(property) &&
          ts.isStringLiteralLike(property.name) &&
          ts.isStringLiteralLike(property.initializer)
        ) {
          assert.equal(
            dictionary.has(property.name.text),
            false,
            `duplicate English translation: ${property.name.text}`,
          );
          dictionary.set(property.name.text, property.initializer.text);
        }
      }
    }
    ts.forEachChild(node, findDictionary);
  }
  findDictionary(i18nFile);

  const replacements = [...dictionary.entries()].sort(
    ([left], [right]) => right.length - left.length,
  );
  function translateStatic(text) {
    let translated = text;
    for (const [source, target] of replacements) {
      if (source.length === 1) {
        if (translated.trim() === source) {
          translated = translated.replace(source, target);
        }
      } else {
        translated = translated.replaceAll(source, target);
      }
    }
    return translated;
  }

  const pageFile = parseSource("game-client.tsx", page);
  const uncovered = [];
  function auditPage(node) {
    const text = staticText(node, pageFile);
    if (
      text &&
      HAN.test(text) &&
      !isInsideLocaleConditional(node, pageFile) &&
      HAN.test(translateStatic(text))
    ) {
      uncovered.push(text);
    }
    ts.forEachChild(node, auditPage);
  }
  auditPage(pageFile);
  assert.deepEqual([...new Set(uncovered)], []);

  const analysisFile = parseSource("trade-analysis.ts", analysis);
  const unlocalizedAnalysis = [];
  function auditAnalysis(node) {
    const text = staticText(node, analysisFile);
    let isTranslationArgument = false;
    for (let parent = node.parent; parent; parent = parent.parent) {
      if (
        ts.isCallExpression(parent) &&
        parent.expression.getText(analysisFile) === "t"
      ) {
        isTranslationArgument = true;
        break;
      }
    }
    if (
      text &&
      HAN.test(text) &&
      !isTranslationArgument &&
      !isInsideLocaleConditional(node, analysisFile)
    ) {
      unlocalizedAnalysis.push(text);
    }
    ts.forEachChild(node, auditAnalysis);
  }
  auditAnalysis(analysisFile);
  assert.deepEqual([...new Set(unlocalizedAnalysis)], []);
  assert.match(page, /buildTradeAnalysis\(\{[\s\S]*locale,/);
  assert.match(analysis, /locale: "zh" \| "en"/);
  assert.match(analysis, /Risk-adjusted Trend Reader/);
  assert.match(i18n, /Up \/ Range \/ Down Probabilities × Realized Move/);
});

test("gives every friend duel a personalized, spoiler-free route", async () => {
  const [page, duelPage, duelImage, duelInvites, styles] = await Promise.all([
    readFile(new URL("../app/game-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/d/[code]/page.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../app/d/[code]/opengraph-image.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/duel-invites.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(
    page,
    /initialDuel\?: \{ code: string; date: string; source: ShareSource \}/,
  );
  assert.match(page, /initialDuel\?\.code \|\| params\.get\("duel"\)/);
  assert.match(page, /`\$\{location\.origin\}\/d\//);
  assert.match(page, /`\/d\/\$\{encodeURIComponent\(code\)\}`/);
  assert.doesNotMatch(page, /shareUrl = .*\?duel=/);
  assert.match(duelPage, /generateMetadata/);
  assert.match(duelPage, /scored \$\{invite\.targetScore\}\. Can you beat it\?/);
  assert.match(duelPage, /No ticker, no future, no sign-up/);
  assert.match(duelPage, /invite\.responseCount/);
  assert.doesNotMatch(duelPage, /images: \[\]/);
  assert.match(duelPage, /summary_large_image/);
  assert.match(duelPage, /imagePath = `\$\{path\}\/opengraph-image`/);
  assert.match(duelPage, /FALLBACK_SHARE_IMAGE/);
  assert.match(duelImage, /ImageResponse/);
  assert.match(duelImage, /getPublicDuelInvite/);
  assert.match(duelImage, /width: 1200, height: 630/);
  assert.match(duelImage, /Same hidden chart · Five decisions · Zero spoilers/);
  assert.match(duelImage, /invite\?\.targetScore/);
  assert.match(duelImage, /safeNickname/);
  assert.doesNotMatch(duelImage, /\.date|stock|ticker|returnRate|actions/);
  assert.match(duelPage, /robots: \{ index: false, follow: false \}/);
  assert.match(duelPage, /searchParams: Promise<\{ via\?: string \| string\[\] \}>/);
  assert.match(duelPage, /normalizeShareSource/);
  assert.match(
    duelPage,
    /initialDuel=\{\{ code: invite\.code, date: invite\.date, source \}\}/,
  );
  assert.doesNotMatch(duelPage, /CHALLENGE EXPIRED/);
  assert.doesNotMatch(duelPage, /marketDate\(invite\.market\)/);
  assert.match(duelPage, /startDailySession\(\s*invite\.date,/);
  assert.match(duelInvites, /duelChallenges\.code/);
  assert.match(duelInvites, /dailyScores\.challengeDate/);
  assert.match(duelInvites, /challengerNickname: score\.nickname/);
  assert.match(styles, /\.duel-route-state/);
});

test("streams an immediate, mode-specific loading state", async () => {
  const [component, daily, practice, training, duel, styles] =
    await Promise.all([
      readFile(new URL("../app/game-loading.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/daily/loading.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/practice/loading.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/training/loading.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/d/[code]/loading.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    ]);
  assert.match(component, /Loading today’s shared mystery/);
  assert.match(component, /Drawing a random real chart/);
  assert.match(component, /Preparing your lesson picker/);
  assert.match(component, /Verifying the same-chart challenge/);
  assert.match(daily, /mode="daily"/);
  assert.match(practice, /mode="practice"/);
  assert.match(training, /mode="training"/);
  assert.match(duel, /mode="duel"/);
  assert.match(styles, /@view-transition\{navigation:auto\}/);
  assert.match(styles, /prefers-reduced-motion:reduce/);
  assert.match(styles, /\.game-loading-shell/);
});

test("keeps ranking authoritative and identity hidden until settlement", async () => {
  const [
    page,
    pageRoute,
    modeLobby,
    gameModePage,
    dailyPage,
    practicePage,
    trainingPage,
    duelLobby,
    scoreRoute,
    challengeRoute,
    quizRoute,
    duelRoute,
    identity,
    sessions,
    schema,
    database,
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
    duelRoomMigration,
    attributionMigration,
    archivedDuelMigration,
  ] = await Promise.all([
    readFile(new URL("../app/game-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/mode-lobby.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/game-mode-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/daily/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/practice/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/training/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/duel/duel-lobby.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/scores/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/challenge/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/quiz/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/duels/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/request-identity.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/challenge-sessions.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/index.ts", import.meta.url), "utf8"),
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
    readFile(
      new URL("../drizzle/0010_cute_sentry.sql", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../drizzle/0011_easy_tyger_tiger.sql", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../drizzle/0012_chemical_richard_fisk.sql", import.meta.url),
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
  assert.match(pageRoute, /<ModeLobby \/>/);
  assert.match(modeLobby, /FOUR WAYS TO PLAY/);
  assert.match(modeLobby, /href: "\/daily"/);
  assert.match(modeLobby, /href: "\/practice"/);
  assert.match(modeLobby, /href: "\/training"/);
  assert.match(modeLobby, /href: "\/duel"/);
  assert.match(gameModePage, /marketDate\(market\)/);
  assert.match(gameModePage, /startDailySession/);
  assert.match(gameModePage, /startPracticeSession/);
  assert.match(gameModePage, /initialMode=\{mode\}/);
  assert.match(dailyPage, /mode="daily"/);
  assert.match(practicePage, /mode="practice"/);
  assert.match(trainingPage, /mode="training"/);
  assert.match(duelLobby, /location\.assign\(`\/d\//);
  assert.match(page, /href="\/"/);
  assert.doesNotMatch(page, /onClick=\{\(\) => setModeHubOpen\(true\)\}/);
  assert.match(challengeRoute, /marketDate\(market\)/);
  assert.match(scoreRoute, /isCurrentChallenge = date === marketDate\(market\)/);
  assert.match(scoreRoute, /历史挑战仅可通过有效好友房间提交/);
  assert.match(duelRoute, /marketDate\(payload\.market\)/);
  assert.match(config, /us: "America\/New_York"/);
  assert.match(config, /cn: "Asia\/Shanghai"/);
  assert.match(config, /export function nextMarketReset/);
  assert.match(config, /export function marketCountdown/);
  assert.match(styles, /\.daily-refresh-banner/);
  assert.match(scoreRoute, /onConflictDoNothing/);
  assert.doesNotMatch(scoreRoute, /payload\.actions/);
  assert.doesNotMatch(gameModePage, /getDailyChallengeBundle/);
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
  assert.match(scoreRoute, /duelResponses/);
  assert.match(scoreRoute, /resolveDuelContext/);
  assert.match(scoreRoute, /responseCount/);
  assert.match(scoreRoute, /duelRoom: duelRoom \?\? null/);
  assert.match(scoreRoute, /payload\.duelCode/);
  assert.match(scoreRoute, /normalizeShareSource\(payload\.duelSource\)/);
  assert.match(scoreRoute, /source: duelSource/);
  assert.match(scoreRoute, /groupBy\(duelResponses\.source\)/);
  assert.match(scoreRoute, /sources: sourceRows/);
  assert.match(scoreRoute, /duelResponseSummary/);
  assert.match(scoreRoute, /playerOverride/);
  assert.match(scoreRoute, /opponentOverride/);
  assert.match(scoreRoute, /if \(isCurrentChallenge\)\s*await db/);
  assert.match(scoreRoute, /returnRate: officialScore\.returnRate/);
  assert.match(scoreRoute, /\.onConflictDoNothing\(\{\s*target: \[\s*duelResponses\.duelCode/);
  assert.match(scoreRoute, /COUNT\(DISTINCT duel_challenges\.code\)/);
  assert.match(scoreRoute, /INNER JOIN duel_responses/);
  assert.match(scoreRoute, /收到 1 位好友的有效同图应战/);
  assert.match(scoreRoute, /respondentPlayerId: playerId/);
  assert.match(scoreRoute, /rankFor\(opponentId\)/);
  assert.match(scoreRoute, /buildAchievements/);
  assert.match(scoreRoute, /calculateStreakProtection/);
  assert.match(scoreRoute, /streakHistory\.results/);
  assert.match(scoreRoute, /ORDER BY challenge_date ASC/);
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
  assert.match(sessions, /每日挑战须先锁定方向与信心/);
  assert.match(sessions, /DAILY_ALLOCATIONS = \[0\.25, 0\.5, 1\]/);
  assert.match(sessions, /session\.mode === "daily" \? 3 : action\.days \|\| 3/);
  assert.match(sessions, /const contributesToDailyMission/);
  assert.match(sessions, /session\.challengeDate === marketDate/);
  assert.match(config, /GAME_VERSION = "focused-daily-v18"/);
  assert.doesNotMatch(sessions, /请完整记录方向、依据和信心/);
  assert.match(schema, /game_sessions/);
  assert.match(schema, /trainingResults/);
  assert.match(schema, /trainingProgress/);
  assert.match(schema, /patternQuizzes/);
  assert.match(schema, /dailyProgress/);
  assert.match(schema, /duelChallenges/);
  assert.match(schema, /duelResponses/);
  assert.match(schema, /source: text\("source"\)\.notNull\(\)\.default\("direct"\)/);
  assert.match(schema, /returnRate: real\("return_rate"\)\.notNull\(\)\.default\(0\)/);
  assert.match(schema, /weeklyRewards/);
  assert.match(schema, /daily_scores_date_player_unique/);
  assert.match(hosting, /"d1": "DB"/);
  assert.match(styles, /\.rules-modal li span\{[^}]*grid-column:2/);
  assert.match(styles, /--up:var\(--green\)/);
  assert.match(styles, /--down:var\(--red\)/);
  assert.match(styles, /\.shell\[data-market="cn"\]\{--up:var\(--red\)/);
  assert.match(styles, /\.up\{color:var\(--up\)!important\}/);
  assert.match(styles, /\.down\{color:var\(--down\)!important\}/);
  assert.match(styles, /\.crowd-up\{background:var\(--up\)\}/);
  assert.match(styles, /\.crowd-down\{background:var\(--down\)\}/);
  assert.match(styles, /Desktop trading terminal/);
  assert.match(styles, /\.shell\{height:100dvh;min-height:0/);
  assert.match(styles, /\.workspace\{min-height:0;flex:1/);
  assert.match(styles, /\.trade-panel>\*\{flex-shrink:0\}/);
  assert.match(styles, /\.probability-contract\{flex:0 0 auto\}/);
  assert.match(styles, /\.guided-start-card/);
  assert.match(styles, /\.first-run-coach/);
  assert.match(styles, /\.coach-focus/);
  assert.match(styles, /\.duel-invite-card/);
  assert.match(styles, /\.duel-target-score/);
  assert.match(styles, /\.duel-room-stats/);
  assert.match(styles, /\.result-share-kit/);
  assert.match(styles, /\.streak-week footer/);
  assert.match(styles, /\.career-freeze-card/);
  assert.match(styles, /\.share-mark-preview/);
  assert.match(
    styles,
    /\.probability-contract \.journal-row\{grid-template-columns:1fr\}/,
  );
  assert.match(config, /ORDER_ALLOCATIONS = \[0\.25, 1 \/ 3, 0\.5, 0\.75, 1\]/);
  assert.match(config, /market === "cn" \? 100 : 1/);
  assert.match(config, /identifies puzzle generation and scoring compatibility/);
  assert.match(config, /focused-daily-v18/);
  assert.match(config, /DAILY_CHALLENGE_DECISIONS = 5/);
  assert.match(config, /transactionQuote/);
  assert.match(config, /gross \* 0\.0005/);
  assert.match(config, /gross \* 0\.0000206/);
  assert.match(sessions, /actions\.length >= DAILY_CHALLENGE_DECISIONS/);
  assert.match(sessions, /nextActions\.length >= DAILY_CHALLENGE_DECISIONS/);
  assert.match(sessions, /getCrowdForecast/);
  assert.match(sessions, /crowdForecasts/);
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
  assert.match(duelRoomMigration, /CREATE TABLE `duel_responses`/);
  assert.match(duelRoomMigration, /duel_responses_duel_player_unique/);
  assert.match(duelRoomMigration, /duel_responses_duel_score_idx/);
  assert.match(attributionMigration, /ALTER TABLE `duel_responses` ADD `source`/);
  assert.match(archivedDuelMigration, /ADD `return_rate`/);
  assert.match(archivedDuelMigration, /ADD `max_drawdown`/);
  assert.match(database, /CREATE TABLE IF NOT EXISTS duel_responses/);
  assert.match(database, /PRAGMA table_info\(duel_responses\)/);
  assert.match(database, /ALTER TABLE duel_responses ADD COLUMN source/);
  assert.match(database, /ALTER TABLE duel_responses ADD COLUMN return_rate/);
  assert.match(database, /PRAGMA optimize/);
  assert.match(analysis, /平均仓位/);
  assert.match(analysis, /trainingGoal/);
  assert.equal((universe.match(/\\"code\\":\\"\d{6}\\"/g) ?? []).length, 5550);
});
