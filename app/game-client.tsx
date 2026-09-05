"use client";

/* eslint-disable jsx-a11y/no-noninteractive-element-interactions -- dialog backdrops only close when the backdrop itself is pressed */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MARKET_UNIVERSE_SIZE,
  type Candle,
  type StockSample,
} from "./stock-types";
import {
  DAILY_CHALLENGE_DECISIONS,
  INITIAL_BARS,
  INITIAL_CASH,
  MARKET_COLORS,
  ORDER_ALLOCATIONS,
  clamp,
  forecastForAction,
  initialBarsFor,
  lotSizeFor,
  marketCountdown,
  marketDate,
  orderQuantity,
  probabilityCalibrationScore,
  probabilityForecast,
  transactionQuote,
  type ConfidenceLevel,
  type DecisionThesis,
  type MarketKind,
  type MarketOutlook,
  type OrderAllocation,
  type ProbabilityForecast,
  type ReplayAction,
} from "./game-config";
import { buildTradeAnalysis } from "./trade-analysis";
import { decisionStyleFor, type DecisionStyle } from "./decision-style";
import { trackActivationEvent } from "./activation-events";
import {
  MARKET_RUN_DECISIONS,
  MARKET_RUN_STAGES,
  marketRunGrade,
  marketRunSessionStorageKey,
  marketRunStorageKey,
  marketRunTotal,
  newMarketRunProgress,
  parseMarketRunProgress,
  recordMarketRunStage,
} from "./market-run";
import {
  createPlatformDuelShareUrl,
  currentWebGamePlatform,
  getWebGameLaunchContext,
  reportPlatformHappyTime,
  reportPlatformGameplayStart,
  reportPlatformGameplayStop,
  reportPlatformLoaded,
} from "./web-game-platform";
import type { CrewSummary } from "./crew-service";
import {
  Localized,
  localeLanguageTag,
  localeNumberTag,
  normalizeLocale,
  type Locale,
} from "./i18n";
import {
  shareComparisonHook,
  shareSourceLabel,
  socialShareHref,
  taggedChallengeUrl,
  type ShareChannel,
  type ShareSource,
} from "./share-links";
import { safeLocalStorage } from "./safe-storage";
import {
  celebrationMilestone,
  isPlatformCelebration,
  type CelebrationMilestone,
} from "./milestone-celebration";

const delay = (ms: number) =>
  new Promise((resolve) => window.setTimeout(resolve, ms));

function documentTitleFor(locale: Locale) {
  if (locale === "zh") return "盲盘｜真实历史 K 线交易挑战";
  if (locale === "es")
    return "Trading a ciegas | Reto con mercados históricos reales";
  if (locale === "fr")
    return "Trading à l’aveugle | Défi sur des marchés historiques réels";
  return "Blind Trading | Real Historical Market Challenge";
}

const SHARE_CARD_COPY: Record<
  Locale,
  {
    calibration: string;
    risk: string;
    beatToday: string;
    decisionStyle: string;
    decisionScore: string;
    nextRun: string;
    canReadBetter: string;
    sameChart: string;
    playToday: string;
    realData: string;
  }
> = {
  en: {
    calibration: "CALIBRATION",
    risk: "RISK CONTROL",
    beatToday: "BEAT TODAY",
    decisionStyle: "YOUR DECISION STYLE",
    decisionScore: "DECISION SCORE",
    nextRun: "NEXT RUN",
    canReadBetter: "CAN YOU READ IT BETTER?",
    sameChart: "Same mystery chart. Five decisions. No ticker until the reveal.",
    playToday: "PLAY TODAY'S HIDDEN CHART",
    realData: "REAL HISTORICAL DATA · TICKER HIDDEN UNTIL REVEAL · NO REAL MONEY",
  },
  zh: {
    calibration: "概率校准",
    risk: "风险控制",
    beatToday: "领先玩家",
    decisionStyle: "你的今日决策风格",
    decisionScore: "决策评分",
    nextRun: "下一局目标",
    canReadBetter: "你能读得更准吗？",
    sameChart: "同一张神秘历史图，五次决策，结算前不看股票与日期。",
    playToday: "挑战今天的隐藏行情",
    realData: "真实历史行情 · 结算前隐藏股票身份 · 不涉及真实资金",
  },
  es: {
    calibration: "CALIBRACIÓN",
    risk: "CONTROL DEL RIESGO",
    beatToday: "SUPERAR HOY",
    decisionStyle: "TU ESTILO DE DECISIÓN",
    decisionScore: "PUNTUACIÓN DE DECISIÓN",
    nextRun: "PRÓXIMA PARTIDA",
    canReadBetter: "¿PUEDES LEERLO MEJOR?",
    sameChart: "El mismo gráfico misterioso. Cinco decisiones. Sin ticker hasta revelar.",
    playToday: "JUEGA EL GRÁFICO OCULTO DE HOY",
    realData: "DATOS HISTÓRICOS REALES · TICKER OCULTO · SIN DINERO REAL",
  },
  fr: {
    calibration: "CALIBRATION",
    risk: "CONTRÔLE DU RISQUE",
    beatToday: "DEVANCER AUJOURD'HUI",
    decisionStyle: "TON STYLE DE DÉCISION",
    decisionScore: "SCORE DE DÉCISION",
    nextRun: "PROCHAINE PARTIE",
    canReadBetter: "PEUX-TU MIEUX LE LIRE ?",
    sameChart: "Le même graphique mystère. Cinq décisions. Ticker révélé à la fin.",
    playToday: "JOUE LE GRAPHIQUE CACHÉ DU JOUR",
    realData: "DONNÉES HISTORIQUES RÉELLES · TICKER CACHÉ · SANS ARGENT RÉEL",
  },
  de: {
    calibration: "KALIBRIERUNG",
    risk: "RISIKOKONTROLLE",
    beatToday: "HEUTE ÜBERTROFFEN",
    decisionStyle: "DEIN ENTSCHEIDUNGSSTIL",
    decisionScore: "ENTSCHEIDUNGSERGEBNIS",
    nextRun: "NÄCHSTER LAUF",
    canReadBetter: "KANNST DU ES BESSER LESEN?",
    sameChart: "Derselbe Mystery-Chart. Fünf Entscheidungen. Der Ticker bleibt bis zur Enthüllung verborgen.",
    playToday: "HEUTIGEN VERBORGENEN CHART SPIELEN",
    realData: "ECHTE HISTORISCHE DATEN · TICKER VERBORGEN · KEIN ECHTES GELD",
  },
  it: {
    calibration: "CALIBRAZIONE",
    risk: "CONTROLLO DEL RISCHIO",
    beatToday: "BATTERE OGGI",
    decisionStyle: "IL TUO STILE DECISIONALE",
    decisionScore: "PUNTEGGIO DECISIONALE",
    nextRun: "PROSSIMA PARTITA",
    canReadBetter: "RIESCI A LEGGERLO MEGLIO?",
    sameChart: "Lo stesso grafico misterioso. Cinque decisioni. Ticker nascosto fino alla rivelazione.",
    playToday: "GIOCA IL GRAFICO NASCOSTO DI OGGI",
    realData: "DATI STORICI REALI · TICKER NASCOSTO · NESSUN DENARO REALE",
  },
};

const SHARE_TEXT_COPY: Record<
  Locale,
  {
    title: string;
    usStocks: string;
    chinaShares: string;
    chain: (round: number) => string;
    crowd: (beat: number, wins: number, calls: number) => string;
    style: (name: string) => string;
    score: (score: number, calibration: number, risk: number) => string;
    challenge: string;
    compact: (name: string, score: number, chain: string, sequence: string) => string;
  }
> = {
  en: {
    title: "BLIND TRADING DAILY",
    usStocks: "US Stocks",
    chinaShares: "China A-shares",
    chain: (round) => ` · CHAIN R${round}`,
    crowd: (beat, wins, calls) => `Crowd edge ${beat} · Contrarian wins ${wins}/${calls}`,
    style: (name) => `Decision style · ${name}`,
    score: (score, calibration, risk) => `Decision ${score} · Calibration ${calibration} · Risk ${risk}`,
    challenge: "Same mystery chart. Five decisions. Can you beat me?",
    compact: (name, score, chain, sequence) => `My Blind Trading style is ${name} · ${score}${chain} ${sequence} Same hidden chart, five calls. Can you beat me?`,
  },
  zh: {
    title: "盲盘每日挑战",
    usStocks: "美股",
    chinaShares: "A股",
    chain: (round) => ` · 接力第 ${round} 轮`,
    crowd: (beat, wins, calls) => `领先人群 ${beat} 次 · 逆向命中 ${wins}/${calls}`,
    style: (name) => `今日决策风格 · ${name}`,
    score: (score, calibration, risk) => `决策 ${score} · 校准 ${calibration} · 风控 ${risk}`,
    challenge: "同一张神秘历史图，五次决策。你能超过我吗？",
    compact: (name, score, chain, sequence) => `我是${name}，盲盘挑战 ${score} 分${chain} ${sequence} 同一张隐藏行情，五次决策。你能超过我吗？`,
  },
  es: {
    title: "TRADING A CIEGAS DIARIO",
    usStocks: "Acciones de EE. UU.",
    chinaShares: "Acciones A de China",
    chain: (round) => ` · CADENA R${round}`,
    crowd: (beat, wins, calls) => `Ventaja sobre la multitud ${beat} · Aciertos contrarios ${wins}/${calls}`,
    style: (name) => `Estilo de decisión · ${name}`,
    score: (score, calibration, risk) => `Decisión ${score} · Calibración ${calibration} · Riesgo ${risk}`,
    challenge: "El mismo gráfico misterioso. Cinco decisiones. ¿Puedes superarme?",
    compact: (name, score, chain, sequence) => `Mi estilo de Trading a ciegas es ${name} · ${score}${chain} ${sequence} Mismo gráfico oculto, cinco decisiones. ¿Puedes superarme?`,
  },
  fr: {
    title: "TRADING À L'AVEUGLE DU JOUR",
    usStocks: "Actions américaines",
    chinaShares: "Actions A chinoises",
    chain: (round) => ` · CHAÎNE R${round}`,
    crowd: (beat, wins, calls) => `Avantage sur la foule ${beat} · Victoires contraires ${wins}/${calls}`,
    style: (name) => `Style de décision · ${name}`,
    score: (score, calibration, risk) => `Décision ${score} · Calibration ${calibration} · Risque ${risk}`,
    challenge: "Le même graphique mystère. Cinq décisions. Peux-tu me battre ?",
    compact: (name, score, chain, sequence) => `Mon style de trading à l'aveugle est ${name} · ${score}${chain} ${sequence} Même graphique caché, cinq décisions. Peux-tu me battre ?`,
  },
  de: {
    title: "BLIND TRADING TÄGLICH",
    usStocks: "US-Aktien",
    chinaShares: "Chinesische A-Aktien",
    chain: (round) => ` · KETTE R${round}`,
    crowd: (beat, wins, calls) => `Vorsprung vor der Community ${beat} · Konträre Treffer ${wins}/${calls}`,
    style: (name) => `Entscheidungsstil · ${name}`,
    score: (score, calibration, risk) => `Entscheidung ${score} · Kalibrierung ${calibration} · Risiko ${risk}`,
    challenge: "Derselbe Mystery-Chart. Fünf Entscheidungen. Kannst du mich schlagen?",
    compact: (name, score, chain, sequence) => `Mein Blind-Trading-Stil ist ${name} · ${score}${chain} ${sequence} Derselbe verborgene Chart, fünf Entscheidungen. Kannst du mich schlagen?`,
  },
  it: {
    title: "BLIND TRADING GIORNALIERO",
    usStocks: "Azioni USA",
    chinaShares: "Azioni A cinesi",
    chain: (round) => ` · CATENA R${round}`,
    crowd: (beat, wins, calls) => `Vantaggio sulla folla ${beat} · Vittorie contrarian ${wins}/${calls}`,
    style: (name) => `Stile decisionale · ${name}`,
    score: (score, calibration, risk) => `Decisione ${score} · Calibrazione ${calibration} · Rischio ${risk}`,
    challenge: "Lo stesso grafico misterioso. Cinque decisioni. Riesci a battermi?",
    compact: (name, score, chain, sequence) => `Il mio stile Blind Trading è ${name} · ${score}${chain} ${sequence} Stesso grafico nascosto, cinque decisioni. Riesci a battermi?`,
  },
};

function trackDuelEvent(
  code: string,
  playerId: string,
  eventType: "view" | "start" | "share",
  source: ShareSource,
) {
  if (!code || !playerId) return;
  void fetch("/api/duel-events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code, playerId, eventType, source }),
    keepalive: true,
  }).catch(() => undefined);
}

type TradeMode = "buy" | "sell";
type OrderInputMode = "allocation" | "quantity";
type GameMode = "daily" | "practice" | "sprint" | "endless";
type ShareSetupStatus = "idle" | "loading" | "ready" | "error";
const DAILY_ORDER_ALLOCATIONS = [
  0.25,
  0.5,
  1,
] as const satisfies readonly OrderAllocation[];
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
};
type ScenarioKind = "random" | "trend" | "reversal" | "crash" | "volatile";
type ScenarioDifficulty = "starter" | "standard" | "expert";

const CELEBRATION_COPY = {
  first_chart: {
    en: {
      eyebrow: "FIRST REAL CHART",
      title: "Your first market read is now evidence.",
      body: "You finished a real historical chart. Compare three before trusting one result.",
    },
    zh: {
      eyebrow: "第一张真实行情",
      title: "你的第一次判断，已经成为证据。",
      body: "你完成了一张真实历史行情。先比较三张图，再相信一次结果。",
    },
  },
  three_chart_sample: {
    en: {
      eyebrow: "SESSION SAMPLE COMPLETE",
      title: "Three charts. One real decision sample.",
      body: "You now have enough contrast to spot a pattern without overlearning one market.",
    },
    zh: {
      eyebrow: "本次判断样本完成",
      title: "三张图，构成第一份真实判断样本。",
      body: "现在已有足够的对照，可以寻找规律，又不会被单一行情误导。",
    },
  },
  training_mastered: {
    en: {
      eyebrow: "TRAINING MASTERED",
      title: "You cleared every training objective.",
      body: "The win came from repeatable process, not just the final return.",
    },
    zh: {
      eyebrow: "训练目标全部达成",
      title: "四项训练目标全部通过。",
      body: "这次通关来自可重复的决策过程，而不只是最终收益。",
    },
  },
  top_decile: {
    en: {
      eyebrow: "TOP-DECILE DAILY",
      title: "Your score landed in today’s top 10%.",
      body: "That is a strong read. Share the same chart challenge without revealing the answer.",
    },
    zh: {
      eyebrow: "今日前 10%",
      title: "你的成绩进入今日前 10%。",
      body: "这是一份出色的判断。分享同图挑战，但不要泄露答案。",
    },
  },
  duel_win: {
    en: {
      eyebrow: "FRIEND DUEL WON",
      title: "You won the same-chart challenge.",
      body: "Same hidden market, same rules, stronger process. Keep the chain going with a rematch.",
    },
    zh: {
      eyebrow: "好友同图对决胜出",
      title: "你赢下了这场同图挑战。",
      body: "相同隐藏行情、相同规则，你的过程更胜一筹。再来一轮延续挑战链。",
    },
  },
  streak_guard: {
    en: {
      eyebrow: "STREAK SAFEGUARD EARNED",
      title: "Your consistency earned a safety net.",
      body: "One future missed day can now be protected automatically. The habit survives real life.",
    },
    zh: {
      eyebrow: "获得连续挑战保护",
      title: "持续行动，为你赢得了一次安全网。",
      body: "未来漏玩一天时会自动保护连续纪录，让习惯经得起现实打断。",
    },
  },
  market_run_complete: {
    en: {
      eyebrow: "MARKET RUN COMPLETE",
      title: "Five markets. One complete run.",
      body: "You held your process as the charts grew harder. That consistency is the real finish line.",
    },
    zh: {
      eyebrow: "五关市场闯关完成",
      title: "五张行情，一次完整闯关。",
      body: "难度逐关提升，你仍守住了决策过程。这份稳定性才是真正的终点。",
    },
  },
} as const satisfies Record<
  CelebrationMilestone,
  Record<"en" | "zh", { eyebrow: string; title: string; body: string }>
>;

const SCENARIO_CONFIG = {
  trend: {
    title: "趋势识别",
    description: "辨别主趋势，练习顺势、加仓与退出节奏",
    mission: "在趋势中控制追高冲动，并争取跑赢持有基准",
    debrief:
      "趋势行情最容易让人把短期回撤误判成反转，也容易在连续上涨后过度加仓。",
  },
  reversal: {
    title: "拐点应对",
    description: "辨别普通反弹与真正的趋势反转",
    mission: "等待确认再交易，减少高信心猜底和猜顶",
    debrief:
      "拐点通常不会一次完成，价格会反复测试原趋势，因此仓位和确认信号比猜中最低点更重要。",
  },
  crash: {
    title: "急跌生存",
    description: "练习减仓、空仓和极端回撤控制",
    mission: "优先活下来，把最大回撤控制在目标线以内",
    debrief:
      "急跌阶段的核心不是抓住每次反弹，而是避免亏损扩大后被迫在最低点退出。",
  },
  volatile: {
    title: "高波动控仓",
    description: "练习仓位大小、交易频率与信心校准",
    mission: "降低无效交易，用仓位吸收价格噪声",
    debrief:
      "高波动会制造大量似是而非的信号，过度交易和高信心重仓往往比方向判断本身更危险。",
  },
} as const;
const DIFFICULTY_CONFIG = {
  starter: { label: "入门", days: 20, drawdown: -15, calibration: 35, excess: -3 },
  standard: { label: "标准", days: 40, drawdown: -10, calibration: 45, excess: 0 },
  expert: { label: "专家", days: 60, drawdown: -7, calibration: 55, excess: 3 },
} as const;
type TradeMarker = {
  index: number;
  type: "B" | "S";
  price: number;
  quantity: number;
  round: number;
};
type RankedScore = {
  nickname: string;
  score: number;
  returnRate: number;
  rank: number;
  percentile?: number;
  isPlayer?: boolean;
  excess?: number;
  maxDrawdown?: number;
};
type WeeklyScore = {
  rank: number;
  nickname: string;
  points: number;
  completedDays: number;
  averageScore: number;
  averageReturn: number;
  averageExcess: number;
  isPlayer?: boolean;
};
type Achievement = {
  key: string;
  badge: string;
  title: string;
  description: string;
  progress: number;
  target: number;
  rewardXp: number;
  unlocked: boolean;
};
type Scoreboard = {
  total: number;
  leaderboard: RankedScore[];
  playerScore: RankedScore | null;
  opponent: RankedScore | null;
  duelCode: string | null;
  shareDuel: null | {
    code: string;
    parentCode: string | null;
    chainDepth: number;
  };
  duelRoom: null | {
    isHost: boolean;
    challengerNickname: string;
    challengerFinished: boolean;
    viewCount: number;
    startCount: number;
    responseCount: number;
    shareCount: number;
    bestNickname: string | null;
    bestScore: number | null;
    rematchCount: number;
    sources: { source: ShareSource; count: number }[];
  };
  weekly: {
    start: string;
    end: string;
    rule: string;
    total: number;
    leaderboard: WeeklyScore[];
    player: WeeklyScore | null;
    mission: {
      games: number;
      contractGames: number;
      riskControlled: number;
      completed: number;
      rewardXp: number;
    };
    lifetimeRewardXp: number;
  };
  stats: null | {
    completedDays: number;
    streak: number;
    streakProtection: {
      availableFreezes: number;
      nextFreezeIn: number;
      freezeUsedToday: boolean;
      freezeEarnedToday: boolean;
      protectedMissedDays: number;
    };
    averageScore: number;
    bestScore: number;
    xp: number;
    level: number;
    levelProgress: number;
    profile: { title: string; text: string };
    training: TrainingProfile;
    achievements: Achievement[];
    unlockedAchievements: number;
    achievementXp: number;
    records: {
      benchmarkWins: number;
      riskControlled: number;
      totalTrades: number;
      bestReturn: number;
      duelCreated: number;
    };
  };
};
type TrainingProfile = {
  progress: Record<string, number>;
  attempts: number;
  passes: number;
  totalDays: number;
  bestScore: number;
  mastered: number;
  ability: {
    risk: number;
    calibration: number;
    execution: number;
    discipline: number;
    performance: number;
  };
  recognition: {
    attempts: number;
    correct: number;
    accuracy: number;
    highConfidenceMisses: number;
    weakestScenario: QuizScenario | null;
    mistakes: number;
  };
  daily: DailyMission;
  missionXp: number;
};
type DailyMission = {
  date: string;
  quiz: number;
  days: number;
  training: number;
  quizCorrect: number;
  rewardXp: number;
  completed: number;
};
type QuizScenario = Exclude<ScenarioKind, "random">;
type PatternQuiz = {
  quizId: string;
  market: MarketKind;
  difficulty: ScenarioDifficulty;
  stock: StockSample;
  universeSize: number;
};
type PatternQuizResult = {
  correct: boolean;
  market: MarketKind;
  answer: QuizScenario;
  actual: QuizScenario;
  confidence: ConfidenceLevel;
  explanation: string;
  identity: {
    name: string;
    code: string;
    market: string;
    from: string;
    to: string;
  };
  trainingProfile: TrainingProfile;
};
export type ChallengeSession = {
  sessionId: string;
  date: string;
  market: MarketKind;
  mode: GameMode;
  stock: StockSample;
  totalBars: number;
  remainingBars: number;
  decisionsUsed: number;
  maxDecisions: number | null;
  universeSize: number;
  dataSource: "live-universe" | "embedded-fallback";
  scenario: ScenarioKind;
  difficulty: ScenarioDifficulty;
  actions: ReplayAction[];
  crowdForecasts?: CrowdForecast[];
  resumed?: boolean;
};
type AdvanceResponse = {
  candles: Candle[];
  remainingBars: number;
  decisionsUsed: number;
  maxDecisions: number | null;
  finished: boolean;
  action: ReplayAction;
  dailyMission: DailyMission | null;
  crowdForecast: CrowdForecast | null;
};

type CrowdForecast = {
  round: number;
  sampleSize: number;
  up: number;
  range: number;
  down: number;
};

function crowdLeader(forecast: CrowdForecast): MarketOutlook | null {
  const values = [
    ["up", forecast.up],
    ["range", forecast.range],
    ["down", forecast.down],
  ] as const;
  const highest = Math.max(...values.map(([, value]) => value));
  const leaders = values.filter(([, value]) => value === highest);
  return leaders.length === 1 ? leaders[0][0] : null;
}

type DecisionFeedback = {
  round: number;
  matched: boolean;
  forecast: MarketOutlook;
  actual: MarketOutlook;
  move: number;
  favorable: number;
  adverse: number;
  title: string;
  lesson: string;
  calibration: number;
};

type DecisionReplayItem = {
  round: number;
  date: string;
  action: "买入" | "卖出" | "观望";
  order: string;
  thesis?: string;
  confidence?: ConfidenceLevel;
  outlook?: MarketOutlook;
  probabilities?: ProbabilityForecast;
  actual: MarketOutlook;
  move: number;
  matched: boolean | null;
  days: number;
};

type RecordedReplayAction = ReplayAction &
  Required<Pick<ReplayAction, "outlook" | "thesis" | "confidence">>;

type OnboardingStep = 0 | 1 | 2 | 3;
type ResultCardVariant = "style" | "score";

const ONBOARDING_STORAGE_KEY = "mangpan-guided-first-chart-v1";

function hasRecordedView(action: ReplayAction): action is RecordedReplayAction {
  return Boolean(action.outlook && action.thesis && action.confidence);
}

const OUTLOOK_LABEL: Record<MarketOutlook, string> = {
  up: "上涨",
  range: "震荡",
  down: "下跌",
};
const OUTLOOK_LABEL_EN: Record<MarketOutlook, string> = {
  up: "UP",
  range: "RANGE",
  down: "DOWN",
};
const THESIS_LABEL: Record<DecisionThesis, string> = {
  trend: "趋势延续",
  breakout: "突破确认",
  reversal: "反转信号",
  volume: "量价配合",
  uncertain: "信号不足",
};

function formatProbabilityForecast(
  forecast: ProbabilityForecast,
  locale: Locale = "zh",
) {
  const display = (value: number) =>
    Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);
  return locale === "en"
    ? `Up ${display(forecast.up)} · Range ${display(forecast.range)} · Down ${display(forecast.down)}`
    : `涨 ${display(forecast.up)} · 震 ${display(forecast.range)} · 跌 ${display(forecast.down)}`;
}

function drawWrappedText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
) {
  const separator = /\s/u.test(text) ? " " : "";
  const words = separator ? text.split(/\s+/u) : Array.from(text);
  let line = "";
  let lineIndex = 0;
  for (const word of words) {
    const candidate = line ? `${line}${separator}${word}` : word;
    if (line && context.measureText(candidate).width > maxWidth) {
      context.fillText(line, x, y + lineIndex * lineHeight);
      lineIndex++;
      if (lineIndex >= maxLines) return;
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line && lineIndex < maxLines)
    context.fillText(line, x, y + lineIndex * lineHeight);
}

async function createResultShareCard({
  locale,
  date,
  market,
  score,
  calibration,
  risk,
  percentile,
  marks,
  challengeUrl,
  decisionStyle,
  variant,
  longCycle,
}: {
  locale: Locale;
  date: string;
  market: MarketKind;
  score: number;
  calibration: number;
  risk: number;
  percentile?: number;
  marks: number[];
  challengeUrl?: string;
  decisionStyle: DecisionStyle;
  variant: ResultCardVariant;
  longCycle: boolean;
}) {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const context = canvas.getContext("2d");
  if (!context) return null;
  const cardCopy = SHARE_CARD_COPY[locale];
  context.fillStyle = "#f4f1e9";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#252721";
  context.fillRect(0, 0, canvas.width, 174);
  context.fillStyle = "#bfc3b7";
  context.font = "700 20px Arial, sans-serif";
  context.fillText(longCycle ? "ENDLESS MARKET RUN" : "DAILY MARKET PUZZLE", 72, 61);
  context.fillStyle = "#f8f6ef";
  context.font = "800 50px Arial, sans-serif";
  context.fillText("BLIND TRADING", 72, 124);
  context.fillStyle = "#bfc3b7";
  context.font = "700 20px Arial, sans-serif";
  context.textAlign = "right";
  context.fillText(
    `#${date.replaceAll("-", "")}`,
    1008,
    73,
  );
  context.fillText(
    market === "us" ? "US STOCKS" : "CHINA A-SHARES",
    1008,
    112,
  );
  context.textAlign = "left";
  const metrics = [
    [cardCopy.calibration, calibration],
    [cardCopy.risk, risk],
    [
      cardCopy.beatToday,
      percentile == null ? "—" : `${percentile}%`,
    ],
  ] as const;
  const displayedMarks = marks.slice(0, DAILY_CHALLENGE_DECISIONS);
  while (displayedMarks.length < DAILY_CHALLENGE_DECISIONS)
    displayedMarks.push(50);
  if (variant === "style") {
    context.fillStyle = "#252721";
    context.fillRect(72, 234, 174, 174);
    context.fillStyle = "#f8f6ef";
    context.font = "800 38px Arial, sans-serif";
    context.textAlign = "center";
    context.fillText(decisionStyle.badge, 159, 334);
    context.textAlign = "left";
    context.fillStyle = "#777970";
    context.font = "800 20px Arial, sans-serif";
    context.fillText(
      cardCopy.decisionStyle,
      286,
      275,
    );
    context.fillStyle = "#252721";
    context.font = "800 58px Arial, sans-serif";
    context.fillText(decisionStyle.title, 286, 355);
    context.fillStyle = "#5f615a";
    context.font = "600 28px Arial, sans-serif";
    drawWrappedText(
      context,
      decisionStyle.description,
      72,
      484,
      936,
      41,
      3,
    );
    metrics.forEach(([label, value], index) => {
      const x = 72 + index * 320;
      context.fillStyle = "#ffffff";
      context.fillRect(x, 620, 288, 154);
      context.fillStyle = "#8b8c84";
      context.font = "800 17px Arial, sans-serif";
      context.fillText(label, x + 24, 661);
      context.fillStyle = "#252721";
      context.font = "800 56px Arial, sans-serif";
      context.fillText(String(value), x + 24, 734);
    });
    displayedMarks.forEach((value, index) => {
      context.fillStyle = value >= 70 ? "#4f785f" : value >= 45 ? "#c1a764" : "#ba625d";
      context.fillRect(72 + index * 192, 822, 168, 60);
    });
    context.fillStyle = "#777970";
    context.font = "800 18px Arial, sans-serif";
    context.fillText(
      `${cardCopy.decisionScore} ${score}`,
      72,
      921,
    );
    context.fillStyle = "#252721";
    context.fillRect(72, 956, 936, 154);
    context.fillStyle = "#bfc3b7";
    context.font = "800 17px Arial, sans-serif";
    context.fillText(cardCopy.nextRun, 102, 996);
    context.fillStyle = "#ffffff";
    context.font = "700 25px Arial, sans-serif";
    drawWrappedText(
      context,
      decisionStyle.nextGoal,
      102,
      1040,
      860,
      34,
      2,
    );
  } else {
    context.fillStyle = "#252721";
    context.font = "800 268px Arial, sans-serif";
    context.fillText(String(score), 62, 505);
    context.fillStyle = "#74766d";
    context.font = "800 24px Arial, sans-serif";
    context.fillText(
      cardCopy.decisionScore,
      76,
      558,
    );
    context.fillStyle = "#4f514a";
    context.font = "800 21px Arial, sans-serif";
    context.fillText(
      `${cardCopy.decisionStyle} · ${decisionStyle.title.toUpperCase()}`,
      72,
      602,
    );
    metrics.forEach(([label, value], index) => {
      const x = 72 + index * 320;
      context.fillStyle = "#ffffff";
      context.fillRect(x, 630, 288, 168);
      context.fillStyle = "#8b8c84";
      context.font = "800 18px Arial, sans-serif";
      context.fillText(label, x + 26, 675);
      context.fillStyle = "#252721";
      context.font = "800 61px Arial, sans-serif";
      context.fillText(String(value), x + 24, 755);
    });
    displayedMarks.forEach((value, index) => {
      context.fillStyle = value >= 70 ? "#4f785f" : value >= 45 ? "#c1a764" : "#ba625d";
      context.fillRect(72 + index * 192, 866, 168, 88);
    });
    context.fillStyle = "#252721";
    context.font = "800 48px Arial, sans-serif";
    context.fillText(
      cardCopy.canReadBetter,
      72,
      1051,
    );
    context.fillStyle = "#777970";
    context.font = "600 22px Arial, sans-serif";
    context.fillText(
      longCycle
        ? locale === "zh"
          ? "一段长周期隐藏行情。你能读到最后吗？"
          : "One long hidden cycle. Can you read it to the end?"
        : cardCopy.sameChart,
      72,
      1095,
    );
  }
  context.fillStyle = "#252721";
  context.fillRect(72, 1150, 936, 105);
  context.fillStyle = "#bfc3b7";
  context.font = "800 17px Arial, sans-serif";
  context.fillText(
    longCycle
      ? locale === "zh"
        ? "继续下一段长周期"
        : "START ANOTHER LONG CYCLE"
      : cardCopy.playToday,
    102,
    1191,
  );
  context.fillStyle = "#ffffff";
  context.font = "700 24px Arial, sans-serif";
  let challengeLabel = "mangpan-kline-game.hiayun.chatgpt.site";
  if (challengeUrl) {
    try {
      const parsed = new URL(challengeUrl);
      challengeLabel = `${parsed.hostname.replace(/^www\./u, "")}${parsed.pathname}`;
    } catch {
      // Keep the public game address when a custom challenge URL is malformed.
    }
  }
  context.fillText(challengeLabel, 102, 1230, challengeUrl ? 770 : 860);
  if (challengeUrl) {
    try {
      const qrCanvas = document.createElement("canvas");
      const { toCanvas } = await import("qrcode");
      await toCanvas(qrCanvas, taggedChallengeUrl(challengeUrl, "qr"), {
        width: 82,
        margin: 1,
        errorCorrectionLevel: "M",
        color: { dark: "#252721", light: "#ffffff" },
      });
      context.fillStyle = "#ffffff";
      context.fillRect(906, 1162, 86, 86);
      context.drawImage(qrCanvas, 908, 1164, 82, 82);
    } catch {
      // Keep the human-readable challenge URL when QR generation is unavailable.
    }
  }
  context.fillStyle = "#8b8c84";
  context.font = "700 16px Arial, sans-serif";
  context.fillText(
    cardCopy.realData,
    72,
    1307,
  );
  return new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
}

function evaluateDecision(
  action: RecordedReplayAction,
  candles: Candle[],
  decisionRound: number,
): DecisionFeedback {
  const execution = candles[0].open;
  const close = candles.at(-1)?.close ?? execution;
  const move = (close / execution - 1) * 100;
  const actual: MarketOutlook =
    move > 0.75 ? "up" : move < -0.75 ? "down" : "range";
  const favorable =
    (Math.max(...candles.map((candle) => candle.high)) / execution - 1) * 100;
  const adverse =
    (Math.min(...candles.map((candle) => candle.low)) / execution - 1) * 100;
  const matched = action.outlook === actual;
  const forecast = forecastForAction(action)!;
  const calibration = probabilityCalibrationScore(forecast, actual);
  let lesson = matched
    ? "方向判断命中。继续观察这套依据能否跨行情重复，而不是因为一次命中突然放大仓位。"
    : action.confidence === 3
      ? "这是一次高信心误判。下次先降低试仓比例，等价格确认后再增加风险。"
      : "方向未命中，但低中信心保留了修正空间；复盘判断依据，而不是只看盈亏。";
  if (action.kind === "buy" && adverse < -3)
    lesson = `买入后最大不利波动达到 ${adverse.toFixed(1)}%，入场容错偏小；可尝试分批建仓。`;
  if (action.kind === "sell" && favorable > 3)
    lesson = `卖出后区间内一度上涨 ${favorable.toFixed(1)}%，可比较一次清仓与分批退出。`;
  if (action.kind === "hold" && matched)
    lesson = "没有交易也完成了有效判断。保持仓位或空仓本身就是需要被记录的决策。";
  return {
    round: decisionRound,
    matched,
    forecast: action.outlook,
    actual,
    move,
    favorable,
    adverse,
    title: `${matched ? "判断命中" : "判断偏差"} · 校准 ${calibration.toFixed(0)} · 后续${OUTLOOK_LABEL[actual]} ${move >= 0 ? "+" : ""}${move.toFixed(2)}%`,
    lesson,
    calibration,
  };
}

function buildDecisionReplay(
  actions: ReplayAction[],
  stock: StockSample,
  normalized: Candle[],
  initialVisibleCount: number,
) {
  const items: DecisionReplayItem[] = [];
  let offset = 0;
  actions.forEach((action, index) => {
    const days = action.days || 3;
    const executionIndex = initialVisibleCount + offset;
    const execution = normalized[executionIndex]?.open ?? 0;
    const outcome =
      normalized[executionIndex + days - 1]?.close ?? execution;
    const move = execution ? (outcome / execution - 1) * 100 : 0;
    const actual: MarketOutlook =
      move > 0.75 ? "up" : move < -0.75 ? "down" : "range";
    const recordedView = hasRecordedView(action);
    const allocationLabel =
      action.allocation === 1
        ? "全仓"
        : action.allocation === 0.75
          ? "3/4 仓"
          : action.allocation === 0.5
            ? "1/2 仓"
            : action.allocation === 0.25
              ? "1/4 仓"
              : action.allocation != null
                ? "1/3 仓"
                : "";
    items.push({
      round: index + 1,
      date: stock.candles[executionIndex]?.date ?? `T${executionIndex + 1}`,
      action:
        action.kind === "buy"
          ? "买入"
          : action.kind === "sell"
            ? "卖出"
            : "观望",
      order:
        action.kind === "hold"
          ? "保持当前仓位"
          : action.quantity != null
            ? `${action.quantity.toLocaleString("zh-CN")} 股`
            : allocationLabel,
      thesis: recordedView ? THESIS_LABEL[action.thesis] : undefined,
      confidence: recordedView ? action.confidence : undefined,
      outlook: recordedView ? action.outlook : undefined,
      probabilities: recordedView ? forecastForAction(action) ?? undefined : undefined,
      actual,
      move,
      matched: recordedView ? action.outlook === actual : null,
      days,
    });
    offset += days;
  });
  return items;
}

function restoreGameState(session: ChallengeSession) {
  const stock = session.stock;
  const initialVisibleCount = initialBarsFor(stock);
  const factor = 100 / stock.candles[initialVisibleCount - 1].close;
  const normalized = stock.candles.map((candle) => ({
    ...candle,
    open: candle.open * factor,
    close: candle.close * factor,
    high: candle.high * factor,
    low: candle.low * factor,
  }));
  let cash = INITIAL_CASH;
  let shares = 0;
  let offset = 0;
  let trades = 0;
  let feesPaid = 0;
  let slippagePaid = 0;
  const markers: TradeMarker[] = [];
  const equityHistory = [INITIAL_CASH];
  const exposureHistory = [0];
  const feedbackHistory: DecisionFeedback[] = [];
  session.actions.forEach((action, actionIndex) => {
    const days = action.days || 3;
    const executionIndex = initialVisibleCount + offset;
    const execution = normalized[executionIndex]?.open;
    if (execution == null) return;
    let amount = 0;
    if (action.kind === "buy" || action.kind === "sell") {
      amount = orderQuantity({
        market: session.market,
        kind: action.kind,
        price: execution,
        cash,
        shares,
        allocation: action.allocation,
        quantity: action.quantity,
      });
      let markerPrice = execution;
      if (action.kind === "buy" && amount > 0) {
        const quote = transactionQuote({
          market: session.market,
          kind: "buy",
          referencePrice: execution,
          quantity: amount,
        });
        cash += quote.cashDelta;
        shares += amount;
        feesPaid += quote.totalFees;
        slippagePaid += quote.slippageCost;
        markerPrice = quote.executionPrice;
      }
      if (action.kind === "sell" && amount > 0) {
        const quote = transactionQuote({
          market: session.market,
          kind: "sell",
          referencePrice: execution,
          quantity: amount,
        });
        shares -= amount;
        cash += quote.cashDelta;
        feesPaid += quote.totalFees;
        slippagePaid += quote.slippageCost;
        markerPrice = quote.executionPrice;
      }
      if (amount > 0) {
        trades++;
        markers.push({
          index: executionIndex,
          type: action.kind === "buy" ? "B" : "S",
          price: markerPrice,
          quantity: amount,
          round: actionIndex,
        });
      }
    }
    const revealed = normalized.slice(executionIndex, executionIndex + days);
    if (revealed.length && hasRecordedView(action))
      feedbackHistory.push(evaluateDecision(action, revealed, actionIndex + 1));
    revealed.forEach((candle) => {
      const equity = cash + shares * candle.close;
      equityHistory.push(equity);
      exposureHistory.push(
        equity > 0 ? ((shares * candle.close) / equity) * 100 : 0,
      );
    });
    offset += revealed.length;
  });
  return {
    cash,
    shares,
    trades,
    markers,
    equityHistory,
    exposureHistory,
    feedbackHistory,
    feesPaid,
    slippagePaid,
    round: session.actions.length,
    visibleCount: stock.candles.length,
  };
}

function average(data: Candle[], at: number, period: number) {
  if (at < period - 1) return null;
  let total = 0;
  for (let i = at - period + 1; i <= at; i++) total += data[i].close;
  return total / period;
}

function formatVolume(value: number, market: MarketKind, locale: Locale) {
  const unit = locale === "en" ? (market === "cn" ? " lots" : " shares") : market === "cn" ? "手" : "股";
  if (locale === "en") {
    if (value >= 100_000_000) return `${(value / 1_000_000).toFixed(2)}M${unit}`;
    if (value >= 10_000) return `${(value / 1_000).toFixed(2)}K${unit}`;
    return `${Math.round(value).toLocaleString("en-US")}${unit}`;
  }
  if (value >= 100_000_000)
    return `${(value / 100_000_000).toFixed(2)}亿${unit}`;
  if (value >= 10_000) return `${(value / 10_000).toFixed(2)}万${unit}`;
  return `${Math.round(value).toLocaleString("zh-CN")}${unit}`;
}

function CandleChart({
  data,
  markers,
  market,
  locale,
}: {
  data: Candle[];
  markers: TradeMarker[];
  market: MarketKind;
  locale: Locale;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef<() => void>(() => undefined);
  const drawFrameRef = useRef<number | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startOffset: number;
    slot: number;
  } | null>(null);
  const touchPointsRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{ distance: number; viewSize: number } | null>(null);
  const previousLengthRef = useRef(data.length);
  const [hover, setHover] = useState<{
    index: number;
    x: number;
    width: number;
  } | null>(null);
  const [viewSize, setViewSize] = useState(INITIAL_BARS);
  const [rightOffset, setRightOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const { up: upColor, down: downColor, buy: buyColor, sell: sellColor } =
    MARKET_COLORS[market];
  const scheduleDraw = useCallback(() => {
    if (drawFrameRef.current != null) return;
    drawFrameRef.current = window.requestAnimationFrame(() => {
      drawFrameRef.current = null;
      drawRef.current();
    });
  }, []);
  const maxView = data.length,
    effectiveView = Math.min(viewSize, data.length);
  const maxOffset = Math.max(0, data.length - effectiveView);
  const effectiveOffset = Math.min(rightOffset, maxOffset);
  const viewEnd = data.length - effectiveOffset;
  const viewStart = Math.max(0, viewEnd - effectiveView);
  const navigationStep = Math.max(1, Math.round(effectiveView / 3));
  const changeZoom = (delta: number) => {
    setHover(null);
    setViewSize((value) => {
      const next = Math.max(24, Math.min(maxView, value + delta));
      setRightOffset((offset) =>
        Math.min(offset, Math.max(0, data.length - next)),
      );
      return next;
    });
  };
  const panBy = (bars: number) => {
    setHover(null);
    setRightOffset((value) => clamp(value + bars, 0, maxOffset));
  };
  const resetView = () => {
    setHover(null);
    setViewSize(Math.min(INITIAL_BARS, maxView));
    setRightOffset(0);
  };
  const showAll = () => {
    setHover(null);
    setViewSize(maxView);
    setRightOffset(0);
  };

  useEffect(() => {
    const added = data.length - previousLengthRef.current;
    previousLengthRef.current = data.length;
    if (added > 0)
      setRightOffset((value) =>
        value > 0
          ? Math.min(value + added, Math.max(0, data.length - effectiveView))
          : 0,
      );
    if (added < 0) setRightOffset(0);
  }, [data.length, effectiveView]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const dpr = window.devicePixelRatio || 1;
      const pixelWidth = Math.round(rect.width * dpr);
      const pixelHeight = Math.round(rect.height * dpr);
      if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
      if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const w = rect.width,
        h = rect.height,
        right = 62,
        top = 18,
        volumeH = 82,
        priceBottom = h - volumeH - 30;
      const start = viewStart,
        shown = data.slice(viewStart, viewEnd);
      const values = shown.flatMap((d) => [d.high, d.low]);
      const min = Math.min(...values),
        max = Math.max(...values),
        range = Math.max(1, max - min),
        pad = range * 0.07;
      const priceY = (value: number) =>
        top + ((max + pad - value) / (range + pad * 2)) * (priceBottom - top);
      const slot = (w - right) / shown.length,
        bodyW = Math.max(2, Math.min(9, slot * 0.62));
      ctx.clearRect(0, 0, w, h);
      ctx.font = "10px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.textAlign = "left";
      for (let i = 0; i < 5; i++) {
        const y = top + ((priceBottom - top) / 4) * i;
        ctx.strokeStyle = "#eae7df";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, Math.round(y) + 0.5);
        ctx.lineTo(w - right, Math.round(y) + 0.5);
        ctx.stroke();
        const label = max + pad - ((range + pad * 2) / 4) * i;
        ctx.fillStyle = "#97958f";
        ctx.fillText(label.toFixed(2), w - right + 8, y + 4);
      }
      for (let i = 0; i <= 4; i++) {
        const x = ((w - right) / 4) * i;
        ctx.strokeStyle = "#f0ede7";
        ctx.beginPath();
        ctx.moveTo(x + 0.5, top);
        ctx.lineTo(x + 0.5, h - 22);
        ctx.stroke();
        if (i < 4) {
          ctx.fillStyle = "#aaa8a2";
          ctx.fillText(
            `T${start + Math.round((shown.length / 4) * i) - data.length}`,
            x + 5,
            h - 7,
          );
        }
      }
      ctx.strokeStyle = "#dedbd3";
      ctx.beginPath();
      ctx.moveTo(0, priceBottom + 17.5);
      ctx.lineTo(w - right, priceBottom + 17.5);
      ctx.stroke();
      const maxVolume = Math.max(...shown.map((d) => d.volume));
      shown.forEach((d, i) => {
        const x = slot * i + slot / 2,
          up = d.close >= d.open,
          color = up ? upColor : downColor;
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(Math.round(x) + 0.5, priceY(d.high));
        ctx.lineTo(Math.round(x) + 0.5, priceY(d.low));
        ctx.stroke();
        const y = Math.min(priceY(d.open), priceY(d.close)),
          bh = Math.max(1.3, Math.abs(priceY(d.open) - priceY(d.close)));
        if (up) {
          ctx.strokeRect(x - bodyW / 2, y, bodyW, bh);
          ctx.fillStyle = "#fffdf9";
          ctx.fillRect(
            x - bodyW / 2 + 1,
            y + 1,
            Math.max(0, bodyW - 2),
            Math.max(0, bh - 2),
          );
        } else ctx.fillRect(x - bodyW / 2, y, bodyW, bh);
        ctx.globalAlpha = 0.34;
        ctx.fillStyle = color;
        const vh = (d.volume / maxVolume) * (volumeH - 22);
        ctx.fillRect(x - bodyW / 2, h - 24 - vh, bodyW, vh);
        ctx.globalAlpha = 1;
      });
      (
        [
          { p: 5, c: "#c9952f" },
          { p: 10, c: "#6b79bd" },
          { p: 20, c: "#a06999" },
        ] as const
      ).forEach(({ p, c }) => {
        ctx.strokeStyle = c;
        ctx.lineWidth = 1.15;
        ctx.globalAlpha = 0.92;
        ctx.beginPath();
        let active = false;
        shown.forEach((_, i) => {
          const value = average(data, start + i, p);
          if (value == null) return;
          const x = slot * i + slot / 2,
            y = priceY(value);
          if (!active) {
            ctx.moveTo(x, y);
            active = true;
          } else ctx.lineTo(x, y);
        });
        ctx.stroke();
        ctx.globalAlpha = 1;
      });
      const last = shown[shown.length - 1],
        ly = priceY(last.close);
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = last.close >= last.open ? upColor : downColor;
      ctx.globalAlpha = 0.65;
      ctx.beginPath();
      ctx.moveTo(0, ly);
      ctx.lineTo(w - right, ly);
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = last.close >= last.open ? upColor : downColor;
      ctx.fillRect(w - right, ly - 10, right, 20);
      ctx.fillStyle = "white";
      ctx.fillText(last.close.toFixed(2), w - right + 7, ly + 4);
      markers
        .filter((marker) => marker.index >= start && marker.index < viewEnd)
        .forEach((marker) => {
          const localIndex = marker.index - start,
            candle = shown[localIndex];
          if (!candle) return;
          const x = slot * localIndex + slot / 2,
            buy = marker.type === "B",
            color = buy ? buyColor : sellColor,
            wickY = priceY(buy ? candle.low : candle.high),
            markerY = buy
              ? Math.min(priceBottom - 11, wickY + 18)
              : Math.max(top + 13, wickY - 18);
          ctx.strokeStyle = color;
          ctx.globalAlpha = 0.72;
          ctx.beginPath();
          ctx.moveTo(x, wickY);
          ctx.lineTo(x, markerY);
          ctx.stroke();
          ctx.globalAlpha = 1;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(x, markerY, 9, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#fff";
          ctx.font = "700 10px Arial";
          ctx.textAlign = "center";
          ctx.fillText(marker.type, x, markerY + 3.5);
          ctx.textAlign = "left";
        });
      if (hover != null && hover.index >= 0 && hover.index < shown.length) {
        const d = shown[hover.index],
          x = slot * hover.index + slot / 2,
          y = priceY(d.close);
        ctx.save();
        ctx.setLineDash([3, 4]);
        ctx.strokeStyle = "#77766f";
        ctx.globalAlpha = 0.55;
        ctx.beginPath();
        ctx.moveTo(x, top);
        ctx.lineTo(x, h - 22);
        ctx.moveTo(0, y);
        ctx.lineTo(w - right, y);
        ctx.stroke();
        ctx.restore();
        ctx.font = "10px ui-monospace, SFMono-Regular, Menlo, monospace";
        ctx.fillStyle = "rgba(38,39,34,.94)";
        ctx.fillRect(w - right, y - 9, right, 18);
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.fillText(d.close.toFixed(2), w - right / 2, y + 3.5);
        ctx.textAlign = "left";
        const dayLabel = locale === "en"
          ? `Day ${start + hover.index + 1}`
          : `第 ${start + hover.index + 1} 日`;
        const labelW = 58,
          labelX = Math.max(0, Math.min(w - right - labelW, x - labelW / 2));
        ctx.fillStyle = "rgba(38,39,34,.94)";
        ctx.fillRect(labelX, h - 21, labelW, 18);
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.fillText(dayLabel, labelX + labelW / 2, h - 8);
        ctx.textAlign = "left";
      }
    };
    drawRef.current = draw;
    scheduleDraw();
  }, [
    data,
    buyColor,
    downColor,
    effectiveView,
    hover,
    locale,
    markers,
    scheduleDraw,
    sellColor,
    upColor,
    viewEnd,
    viewStart,
  ]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(scheduleDraw);
    observer.observe(canvas);
    return () => {
      observer.disconnect();
      if (drawFrameRef.current != null)
        window.cancelAnimationFrame(drawFrameRef.current);
    };
  }, [scheduleDraw]);

  const hoverIndex = hover ? viewStart + hover.index : -1;
  const hoverCandle = hoverIndex >= 0 ? data[hoverIndex] : null;
  const hoverPrevious = hoverIndex > 0 ? data[hoverIndex - 1] : hoverCandle;
  const hoverChange =
    hoverCandle && hoverPrevious ? hoverCandle.close - hoverPrevious.close : 0;
  const hoverChangeRate =
    hoverCandle && hoverPrevious
      ? (hoverCandle.close / hoverPrevious.close - 1) * 100
      : 0;
  const hoverAmplitude =
    hoverCandle && hoverPrevious
      ? ((hoverCandle.high - hoverCandle.low) / hoverPrevious.close) * 100
      : 0;
  const volumeWindow =
    hoverIndex > 0 ? data.slice(Math.max(0, hoverIndex - 5), hoverIndex) : [];
  const averageVolume = volumeWindow.length
    ? volumeWindow.reduce((sum, candle) => sum + candle.volume, 0) /
      volumeWindow.length
    : hoverCandle?.volume || 1;
  const hoverTrade = markers.find((marker) => marker.index === hoverIndex);
  const priceClass = (value: number) =>
    !hoverPrevious
      ? "flat"
      : value > hoverPrevious.close
        ? "quote-up"
        : value < hoverPrevious.close
          ? "quote-down"
          : "flat";

  return (
    <Localized locale={locale}>
    <div className="chart-area">
      <div className="chart-tools">
        <div className="trade-legend">
          <span className="buy-dot">B</span>买入点
          <span className="sell-dot">S</span>卖出点
        </div>
        <div className="chart-actions">
          <div className="pan-tools">
            <button
              onClick={() => panBy(navigationStep)}
              disabled={effectiveOffset >= maxOffset}
              aria-label="向左查看更早K线"
              title="向左查看更早K线"
            >
              ←
            </button>
            <button
              onClick={() => panBy(-navigationStep)}
              disabled={effectiveOffset <= 0}
              aria-label="向右查看更新K线"
              title="向右查看更新K线"
            >
              →
            </button>
            <button
              className="text-tool"
              onClick={() => setRightOffset(0)}
              disabled={effectiveOffset <= 0}
            >
              最新
            </button>
            <input
              className="history-slider"
              type="range"
              min={0}
              max={maxOffset}
              value={maxOffset - effectiveOffset}
              disabled={maxOffset <= 0}
              aria-label="定位K线历史位置"
              onChange={(event) => {
                setHover(null);
                setRightOffset(maxOffset - Number(event.target.value));
              }}
            />
          </div>
          <div className="zoom-tools">
            <small>
              {effectiveOffset
                ? `距最新 ${effectiveOffset} 根`
                : `显示 ${effectiveView} 根`}
            </small>
            <button
              onClick={() => changeZoom(12)}
              disabled={effectiveView >= maxView}
              aria-label="缩小K线图"
            >
              −
            </button>
            <button
              onClick={() => changeZoom(-12)}
              disabled={effectiveView <= 24}
              aria-label="放大K线图"
            >
              ＋
            </button>
            <button
              className="reset-zoom"
              onClick={showAll}
              disabled={effectiveView >= maxView && effectiveOffset === 0}
            >
              全部
            </button>
            <button
              className="reset-zoom"
              onClick={resetView}
              disabled={
                effectiveView === Math.min(INITIAL_BARS, maxView) &&
                effectiveOffset === 0
              }
            >
              复位
            </button>
          </div>
        </div>
      </div>
      <canvas
        ref={canvasRef}
        tabIndex={0}
        className={`chart-canvas ${dragging ? "dragging" : ""}`}
        aria-label="可缩放、拖动和键盘操作的真实历史日K线图"
        onDoubleClick={resetView}
        onWheel={(event) => {
          event.preventDefault();
          if (event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY))
            panBy(
              (event.deltaX || event.deltaY) > 0
                ? navigationStep
                : -navigationStep,
            );
          else changeZoom(event.deltaY > 0 ? 8 : -8);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") panBy(navigationStep);
          else if (event.key === "ArrowRight") panBy(-navigationStep);
          else if (event.key === "Home") setRightOffset(maxOffset);
          else if (event.key === "End") setRightOffset(0);
          else if (event.key === "+" || event.key === "=") changeZoom(-12);
          else if (event.key === "-" || event.key === "_") changeZoom(12);
          else if (event.key === "0") resetView();
          else return;
          event.preventDefault();
        }}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          const rect = event.currentTarget.getBoundingClientRect();
          event.currentTarget.setPointerCapture(event.pointerId);
          if (event.pointerType === "touch") {
            touchPointsRef.current.set(event.pointerId, {
              x: event.clientX,
              y: event.clientY,
            });
            const points = [...touchPointsRef.current.values()];
            if (points.length >= 2) {
              pinchRef.current = {
                distance: Math.hypot(
                  points[0].x - points[1].x,
                  points[0].y - points[1].y,
                ),
                viewSize: effectiveView,
              };
              dragRef.current = null;
            } else
              dragRef.current = {
                pointerId: event.pointerId,
                startX: event.clientX,
                startOffset: effectiveOffset,
                slot: Math.max(1, (rect.width - 62) / effectiveView),
              };
          } else
            dragRef.current = {
              pointerId: event.pointerId,
              startX: event.clientX,
              startOffset: effectiveOffset,
              slot: Math.max(1, (rect.width - 62) / effectiveView),
            };
          setDragging(true);
          setHover(null);
        }}
        onPointerUp={(event) => {
          touchPointsRef.current.delete(event.pointerId);
          pinchRef.current = null;
          if (dragRef.current?.pointerId === event.pointerId)
            dragRef.current = null;
          if (event.currentTarget.hasPointerCapture(event.pointerId))
            event.currentTarget.releasePointerCapture(event.pointerId);
          setDragging(false);
        }}
        onPointerCancel={() => {
          touchPointsRef.current.clear();
          pinchRef.current = null;
          dragRef.current = null;
          setDragging(false);
        }}
        onPointerLeave={() => {
          if (!dragRef.current) setHover(null);
        }}
        onPointerMove={(event) => {
          if (
            event.pointerType === "touch" &&
            touchPointsRef.current.has(event.pointerId)
          ) {
            touchPointsRef.current.set(event.pointerId, {
              x: event.clientX,
              y: event.clientY,
            });
            const points = [...touchPointsRef.current.values()],
              pinch = pinchRef.current;
            if (pinch && points.length >= 2) {
              const distance = Math.max(
                1,
                Math.hypot(
                  points[0].x - points[1].x,
                  points[0].y - points[1].y,
                ),
              );
              const next = clamp(
                Math.round((pinch.viewSize * pinch.distance) / distance),
                24,
                maxView,
              );
              setViewSize(next);
              setRightOffset((offset) =>
                Math.min(offset, Math.max(0, data.length - next)),
              );
              return;
            }
          }
          const drag = dragRef.current;
          if (drag?.pointerId === event.pointerId) {
            setRightOffset(
              clamp(
                drag.startOffset +
                  Math.round((event.clientX - drag.startX) / drag.slot),
                0,
                maxOffset,
              ),
            );
            return;
          }
          if (event.pointerType !== "mouse") return;
          const rect = event.currentTarget.getBoundingClientRect();
          const slot = (rect.width - 62) / effectiveView;
          setHover({
            index: Math.max(
              0,
              Math.min(
                effectiveView - 1,
                Math.floor(event.nativeEvent.offsetX / slot),
              ),
            ),
            x: event.nativeEvent.offsetX,
            width: rect.width,
          });
        }}
      />
      {hover && hoverCandle && hoverPrevious && (
        <div
          className="market-tooltip"
          style={
            hover.x < hover.width / 2
              ? { left: Math.max(8, hover.x + 14) }
              : { right: Math.max(70, hover.width - hover.x + 14) }
          }
        >
          <div className="tooltip-head">
            <b>第 {hoverIndex + 1} 日</b>
            <span>
              {hoverTrade
                ? `${hoverTrade.type} · ${hoverTrade.type === "B" ? "买入成交" : "卖出成交"}`
                : "日期隐藏"}
            </span>
          </div>
          <dl>
            <div>
              <dt>开盘</dt>
              <dd className={priceClass(hoverCandle.open)}>
                {hoverCandle.open.toFixed(2)}
              </dd>
            </div>
            <div>
              <dt>收盘</dt>
              <dd className={priceClass(hoverCandle.close)}>
                {hoverCandle.close.toFixed(2)}
              </dd>
            </div>
            <div>
              <dt>最高</dt>
              <dd className={priceClass(hoverCandle.high)}>
                {hoverCandle.high.toFixed(2)}
              </dd>
            </div>
            <div>
              <dt>最低</dt>
              <dd className={priceClass(hoverCandle.low)}>
                {hoverCandle.low.toFixed(2)}
              </dd>
            </div>
            <div>
              <dt>涨跌</dt>
              <dd className={hoverChange >= 0 ? "quote-up" : "quote-down"}>
                {hoverChange >= 0 ? "+" : ""}
                {hoverChange.toFixed(2)}
              </dd>
            </div>
            <div>
              <dt>涨幅</dt>
              <dd className={hoverChangeRate >= 0 ? "quote-up" : "quote-down"}>
                {hoverChangeRate >= 0 ? "+" : ""}
                {hoverChangeRate.toFixed(2)}%
              </dd>
            </div>
            <div>
              <dt>振幅</dt>
              <dd>{hoverAmplitude.toFixed(2)}%</dd>
            </div>
            <div>
              <dt>成交量</dt>
              <dd>{formatVolume(hoverCandle.volume, market, locale)}</dd>
            </div>
            <div>
              <dt>量比</dt>
              <dd>{(hoverCandle.volume / averageVolume).toFixed(2)}</dd>
            </div>
          </dl>
          <div className="tooltip-ma">
            <span>
              MA5 <b>{average(data, hoverIndex, 5)?.toFixed(2) || "—"}</b>
            </span>
            <span>
              MA10 <b>{average(data, hoverIndex, 10)?.toFixed(2) || "—"}</b>
            </span>
            <span>
              MA20 <b>{average(data, hoverIndex, 20)?.toFixed(2) || "—"}</b>
            </span>
          </div>
        </div>
      )}
    </div>
    </Localized>
  );
}

export default function GameClient({
  initialChallenge,
  initialIdentity,
  initialDuel,
  initialMode = "daily",
  initialGuide = false,
  initialCrewCode,
}: {
  initialChallenge: ChallengeSession;
  initialIdentity: { playerId: string; cloud: true } | null;
  initialDuel?: {
    code: string;
    date: string;
    source: ShareSource;
    chainDepth: number;
  };
  initialMode?:
    | "daily"
    | "practice"
    | "sprint"
    | "endless"
    | "training"
    | "run";
  initialGuide?: boolean;
  initialCrewCode?: string;
}) {
  const router = useRouter();
  const isMarketRun = initialMode === "run";
  const [locale, setLocale] = useState<Locale>("en");
  const [market, setMarket] = useState<MarketKind>(initialChallenge.market);
  const [gameMode, setGameMode] = useState<GameMode>(
    initialMode === "daily"
      ? "daily"
      : initialMode === "sprint"
        ? "sprint"
        : initialMode === "endless"
          ? "endless"
        : "practice",
  );
  const isQuickRead = gameMode === "sprint";
  const isEndlessMode = gameMode === "endless";
  const isBoundedChallenge = gameMode === "daily" || gameMode === "sprint";
  const [session, setSession] = useState(initialChallenge);
  const [stock, setStock] = useState(initialChallenge.stock);
  const [visibleCount, setVisibleCount] = useState(() =>
      initialBarsFor(initialChallenge.stock),
    ),
    [round, setRound] = useState(0);
  const [cash, setCash] = useState(INITIAL_CASH),
    [shares, setShares] = useState(0);
  const [mode, setMode] = useState<TradeMode>("buy"),
    [allocation, setAllocation] = useState<OrderAllocation>(1);
  const [orderInputMode, setOrderInputMode] =
      useState<OrderInputMode>("allocation"),
    [quantityInput, setQuantityInput] = useState("");
  const [revealDays, setRevealDays] = useState<1 | 3 | 5>(3);
  const [outlook, setOutlook] = useState<MarketOutlook>("up");
  const [thesis, setThesis] = useState<DecisionThesis>("trend");
  const [confidence, setConfidence] = useState<ConfidenceLevel>(2);
  const [forecastTouched, setForecastTouched] = useState(false);
  const [recordView, setRecordView] = useState(
    initialMode !== "practice",
  );
  const [trades, setTrades] = useState(0),
    [tradeMarkers, setTradeMarkers] = useState<TradeMarker[]>([]);
  const [feesPaid, setFeesPaid] = useState(0);
  const [slippagePaid, setSlippagePaid] = useState(0);
  const [equityHistory, setEquityHistory] = useState([INITIAL_CASH]);
  const [exposureHistory, setExposureHistory] = useState([0]);
  const [finished, setFinished] = useState(false),
    [resultOpen, setResultOpen] = useState(false),
    [rulesOpen, setRulesOpen] = useState(false),
    [isRevealing, setIsRevealing] = useState(false);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [lastFeedback, setLastFeedback] =
    useState<DecisionFeedback | null>(null);
  const [decisionRevealOpen, setDecisionRevealOpen] = useState(false);
  const [feedbackHistory, setFeedbackHistory] = useState<DecisionFeedback[]>(
    [],
  );
  const [crowdHistory, setCrowdHistory] = useState<CrowdForecast[]>(
    initialChallenge.crowdForecasts ?? [],
  );
  const [onboardingStep, setOnboardingStep] =
    useState<OnboardingStep>(initialGuide ? 1 : 0);
  const [guidedRunActive, setGuidedRunActive] = useState(initialGuide);
  const [trainingOpen, setTrainingOpen] = useState(
    initialMode === "training",
  );
  const [quizOpen, setQuizOpen] = useState(false);
  const [patternQuiz, setPatternQuiz] = useState<PatternQuiz | null>(null);
  const [quizAnswer, setQuizAnswer] = useState<QuizScenario | null>(null);
  const [quizConfidence, setQuizConfidence] =
    useState<ConfidenceLevel>(2);
  const [quizResult, setQuizResult] = useState<PatternQuizResult | null>(null);
  const [quizLoading, setQuizLoading] = useState(false);
  const [selectedDifficulty, setSelectedDifficulty] =
    useState<ScenarioDifficulty>("standard");
  const [scenarioProgress, setScenarioProgress] = useState<
    Record<string, number>
  >({});
  const [trainingProfile, setTrainingProfile] =
    useState<TrainingProfile | null>(null);
  const [revealPulse, setRevealPulse] = useState(0),
    [shareStatus, setShareStatus] = useState("");
  const [cardStatus, setCardStatus] = useState("");
  const [resultCardVariant, setResultCardVariant] =
    useState<ResultCardVariant>("style");
  const [duelRoomShareStatus, setDuelRoomShareStatus] = useState("");
  const [duelShareUrl, setDuelShareUrl] = useState("");
  const [shareSetupStatus, setShareSetupStatus] =
    useState<ShareSetupStatus>("idle");
  const sessionThreeMinutesTrackedRef = useRef(false);
  const [installPrompt, setInstallPrompt] =
    useState<InstallPromptEvent | null>(null);
  const [installStatus, setInstallStatus] = useState("");
  const [storageIsEphemeral, setStorageIsEphemeral] = useState(false);
  const [sessionChainCount, setSessionChainCount] = useState(0);
  const [celebration, setCelebration] =
    useState<CelebrationMilestone | null>(null);
  const [actions, setActions] = useState<ReplayAction[]>([]),
    [playerId, setPlayerId] = useState("");
  const [nickname, setNickname] = useState("MarketReader"),
    [duelCode, setDuelCode] = useState("");
  const [duelInviteOpen, setDuelInviteOpen] = useState(Boolean(initialDuel));
  const [duelGuidePending, setDuelGuidePending] = useState(false);
  const [scoreboard, setScoreboard] = useState<Scoreboard | null>(null),
    [scoreboardOpen, setScoreboardOpen] = useState(false);
  const [crewResult, setCrewResult] = useState<CrewSummary | null>(null);
  const [boardTab, setBoardTab] = useState<"daily" | "weekly">("daily");
  const [replayLimit, setReplayLimit] = useState(8);
  const [scoreStatus, setScoreStatus] = useState<
    "idle" | "loading" | "done" | "error"
  >("idle");
  const [challengeLoading, setChallengeLoading] = useState(false);
  const [marketRunProgress, setMarketRunProgress] = useState(() =>
    newMarketRunProgress(initialChallenge.market),
  );
  const [dailyCountdown, setDailyCountdown] = useState(() =>
    marketCountdown(initialChallenge.market),
  );
  const [currentMarketDate, setCurrentMarketDate] = useState(() =>
    marketDate(initialChallenge.market),
  );
  const submissionRef = useRef(false);
  const duelSharePromiseRef = useRef<Promise<string> | null>(null);
  const resumeAttemptRef = useRef(new Set<MarketKind>());
  const marketRunProgressLoadedRef = useRef(false);
  const marketRunStartTrackedRef = useRef(false);
  const endlessStartTrackedRef = useRef(false);
  const endlessCompletedSessionsRef = useRef(new Set<string>());
  const guideCompleteTrackedRef = useRef(false);
  const celebrationSeenRef = useRef(new Set<string>());
  const initialUrlHandledRef = useRef(false);
  const challengeRequestCacheRef = useRef(
    new Map<string, Promise<ChallengeSession>>(),
  );
  const activeSessionStorageKey = useCallback(
    (value: MarketKind) =>
      isMarketRun
        ? marketRunSessionStorageKey(value)
        : isEndlessMode
          ? `mangpan-endless-session-${value}`
          : `mangpan-active-session-${value}`,
    [isEndlessMode, isMarketRun],
  );
  useEffect(() => {
    reportPlatformLoaded();
    let cancelled = false;
    void getWebGameLaunchContext().then((context) => {
      if (cancelled) return;
      if (context.locale) {
        setLocale(context.locale);
        document.documentElement.lang = localeLanguageTag(context.locale);
        document.title = documentTitleFor(context.locale);
      }
      if (context.duelCode && !initialDuel) {
        router.replace(`/d/${encodeURIComponent(context.duelCode)}`);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [initialDuel, router]);
  useEffect(() => {
    if (!isMarketRun) return;
    const timer = window.setTimeout(() => {
      const restored = parseMarketRunProgress(
        safeLocalStorage.getItem(marketRunStorageKey(market)),
        market,
      );
      marketRunProgressLoadedRef.current = true;
      setMarketRunProgress(restored);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [isMarketRun, market]);
  useEffect(() => {
    const saved = safeLocalStorage.getItem("mangpan-locale");
    const detected = normalizeLocale(
      saved || navigator.languages?.[0] || navigator.language,
    );
    const timer = window.setTimeout(() => setLocale(detected), 0);
    document.documentElement.lang = localeLanguageTag(detected);
    document.title = documentTitleFor(detected);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled && !safeLocalStorage.isPersistent())
        setStorageIsEphemeral(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    const captureInstallPrompt = (event: Event) => {
      if (currentWebGamePlatform() !== "standalone") return;
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const clearInstallPrompt = () => setInstallPrompt(null);
    window.addEventListener("beforeinstallprompt", captureInstallPrompt);
    window.addEventListener("appinstalled", clearInstallPrompt);
    return () => {
      window.removeEventListener("beforeinstallprompt", captureInstallPrompt);
      window.removeEventListener("appinstalled", clearInstallPrompt);
    };
  }, []);
  useEffect(() => {
    const update = () => {
      setDailyCountdown(marketCountdown(market));
      setCurrentMarketDate(marketDate(market));
    };
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [market]);
  useEffect(() => {
    if (!onboardingStep) return;
    const frame = window.requestAnimationFrame(() => {
      const selector =
        onboardingStep === 1
          ? ".probability-contract"
          : onboardingStep === 2
            ? ".primary-action"
            : ".decision-feedback";
      document.querySelector(selector)?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "center",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [onboardingStep]);
  useEffect(() => {
    if (!decisionRevealOpen) return;
    const timer = window.setTimeout(() => setDecisionRevealOpen(false), 5600);
    return () => window.clearTimeout(timer);
  }, [decisionRevealOpen, lastFeedback?.round]);
  const changeLocale = (next: Locale) => {
    setLocale(next);
    safeLocalStorage.setItem("mangpan-locale", next);
    document.documentElement.lang = localeLanguageTag(next);
    document.title = documentTitleFor(next);
  };
  const numberLocale = localeNumberTag(locale);
  const copyLocale = locale === "zh" ? "zh" : "en";
  const nf = useMemo(
    () =>
      new Intl.NumberFormat(numberLocale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    [numberLocale],
  );
  const shareNf = useMemo(
    () => new Intl.NumberFormat(numberLocale, { maximumFractionDigits: 0 }),
    [numberLocale],
  );
  const today = gameMode === "daily" ? session.date : currentMarketDate;
  const historicalDuel = Boolean(
    initialDuel && gameMode === "daily" && session.date !== currentMarketDate,
  );
  const dailyExpired =
    gameMode === "daily" && session.date !== currentMarketDate && !initialDuel;
  const platformGameplayActive = !(
    finished ||
    resultOpen ||
    rulesOpen ||
    analysisOpen ||
    trainingOpen ||
    quizOpen ||
    scoreboardOpen ||
    duelInviteOpen ||
    challengeLoading ||
    dailyExpired
  );
  useEffect(() => {
    // The rendered chart is already playable before the first click. Report that
    // first frame immediately, then mirror real browser and in-game pauses.
    const syncPlatformGameplay = () => {
      if (platformGameplayActive && !document.hidden)
        reportPlatformGameplayStart();
      else reportPlatformGameplayStop();
    };
    syncPlatformGameplay();
    document.addEventListener("visibilitychange", syncPlatformGameplay);
    return () =>
      document.removeEventListener("visibilitychange", syncPlatformGameplay);
  }, [platformGameplayActive]);
  useEffect(() => () => reportPlatformGameplayStop(), []);
  const marketLabel = market === "cn" ? "A股" : "美股";
  const marketResetLabel =
    locale === "en"
      ? market === "us"
        ? "NEW YORK MIDNIGHT"
        : "SHANGHAI MIDNIGHT"
      : market === "us"
        ? "纽约午夜"
        : "上海午夜";
  const scenarioLabel = (
    {
      random: "随机练习",
      trend: "趋势识别",
      reversal: "拐点应对",
      crash: "急跌生存",
      volatile: "高波动控仓",
    } as const
  )[session.scenario];
  const activeScenario =
    session.scenario === "random" ? null : SCENARIO_CONFIG[session.scenario];
  const activeDifficulty = DIFFICULTY_CONFIG[session.difficulty];
  const dailyMission: DailyMission = trainingProfile?.daily ?? {
    date: today,
    quiz: 0,
    days: 0,
    training: 0,
    quizCorrect: 0,
    rewardXp: 0,
    completed: 0,
  };
  const weakestRecognition = trainingProfile?.recognition.weakestScenario;
  const activeDuel = Boolean(
    duelCode && scoreboard?.duelCode?.toUpperCase() === duelCode,
  );
  const showSessionMomentum = Boolean(
    !isMarketRun &&
      !activeDuel &&
      !initialCrewCode &&
      !activeScenario &&
      initialMode !== "training",
  );
  const currentStreak = scoreboard?.stats?.streak ?? 0;
  const streakProtection = scoreboard?.stats?.streakProtection ?? {
    availableFreezes: 0,
    nextFreezeIn: 5,
    freezeUsedToday: false,
    freezeEarnedToday: false,
    protectedMissedDays: 0,
  };
  const completedDailyChallenges = scoreboard?.stats?.completedDays ?? 0;
  const dailyDecisionTarget =
    session.maxDecisions ?? DAILY_CHALLENGE_DECISIONS;
  const dailyDecisionsRemaining = Math.max(
    0,
    dailyDecisionTarget - session.decisionsUsed,
  );
  const marketRunCompletedStages = Math.min(
    MARKET_RUN_STAGES.length,
    marketRunProgress.scores.length,
  );
  const marketRunStageIndex = Math.min(
    MARKET_RUN_STAGES.length - 1,
    marketRunCompletedStages,
  );
  const marketRunStage = MARKET_RUN_STAGES[marketRunStageIndex];
  const marketRunFinished =
    marketRunCompletedStages >= MARKET_RUN_STAGES.length;
  const marketRunScore = marketRunTotal(marketRunProgress.scores);
  const marketRunAverage = marketRunProgress.scores.length
    ? Math.round(marketRunScore / marketRunProgress.scores.length)
    : 0;
  const requiresForecast =
    isBoundedChallenge || isEndlessMode || isMarketRun || guidedRunActive;
  const crowdForecast = crowdHistory.at(-1) ?? null;
  const currencySymbol = market === "cn" ? "¥" : "$";
  const initialVisibleCount = initialBarsFor(stock);
  const normalized = useMemo(() => {
    const factor = 100 / stock.candles[initialVisibleCount - 1].close;
    return stock.candles.map((candle) => ({
      ...candle,
      open: candle.open * factor,
      close: candle.close * factor,
      high: candle.high * factor,
      low: candle.low * factor,
    }));
  }, [initialVisibleCount, stock]);
  const data = normalized.slice(0, visibleCount),
    current = data[data.length - 1],
    previous = data[data.length - 2];
  const positionValue = shares * current.close,
    equity = cash + positionValue,
    returnRate = (equity / INITIAL_CASH - 1) * 100,
    dayChange = (current.close / previous.close - 1) * 100;
  const lotSize = lotSizeFor(market),
    enteredQuantity = quantityInput === "" ? undefined : Number(quantityInput);
  const maxQuotedQuantity = orderQuantity({
    market,
    kind: mode,
    price: current.close,
    cash,
    shares,
    allocation: 1,
  });
  const quantityError =
    orderInputMode !== "quantity"
      ? ""
      : enteredQuantity === undefined
        ? "请输入委托股数"
        : !Number.isInteger(enteredQuantity) || enteredQuantity <= 0
          ? "请输入正整数股数"
          : market === "cn" && enteredQuantity % lotSize !== 0
            ? `A股${mode === "buy" ? "买入" : "卖出"}须为 ${lotSize} 股的整数倍`
            : enteredQuantity > maxQuotedQuantity
              ? mode === "buy"
                ? "委托股数超过当前可用资金"
                : "委托股数超过当前持仓"
              : "";
  const estimatedQuantity = quantityError
    ? 0
    : orderQuantity({
        market,
        kind: mode,
        price: current.close,
        cash,
        shares,
        allocation,
        quantity: orderInputMode === "quantity" ? enteredQuantity : undefined,
      });
  const estimatedQuote = transactionQuote({
    market,
    kind: mode,
    referencePrice: current.close,
    quantity: estimatedQuantity,
  });
  const advancedDays = visibleCount - initialVisibleCount;
  const remainingDays = Math.max(0, session.remainingBars);
  const ma5 = average(data, data.length - 1, 5),
    ma10 = average(data, data.length - 1, 10),
    ma20 = average(data, data.length - 1, 20);
  const benchmark =
      (current.close / data[initialVisibleCount - 1].close - 1) * 100,
    excess = returnRate - benchmark;
  const maxDrawdown = useMemo(() => {
    let peak = equityHistory[0],
      worst = 0;
    equityHistory.forEach((value) => {
      peak = Math.max(peak, value);
      worst = Math.min(worst, (value / peak - 1) * 100);
    });
    return worst;
  }, [equityHistory]);
  const decisionStats = useMemo(() => {
    let offset = 0,
      total = 0,
      hits = 0,
      calibrationTotal = 0,
      confidentMisses = 0,
      tradeEdgeTotal = 0,
      tradeEdgeSamples = 0;
    for (const action of actions) {
      const days = action.days || 3;
      const execution = normalized[initialVisibleCount + offset]?.open;
      const outcome =
        normalized[initialVisibleCount + offset + days - 1]?.close;
      if (execution != null && outcome != null) {
        const move = (outcome / execution - 1) * 100;
        const actual = move > 0.75 ? "up" : move < -0.75 ? "down" : "range";
        if (hasRecordedView(action)) {
          const matched = action.outlook === actual;
          const forecast = forecastForAction(action)!;
          total++;
          calibrationTotal += probabilityCalibrationScore(forecast, actual);
          if (matched) {
            hits++;
          } else if (action.confidence === 3) confidentMisses++;
        }
        if (action.kind === "buy" || action.kind === "sell") {
          const fill = transactionQuote({
            market,
            kind: action.kind,
            referencePrice: execution,
            quantity: 1,
          }).executionPrice;
          const fillMove = (outcome / fill - 1) * 100;
          tradeEdgeTotal += action.kind === "buy" ? fillMove : -fillMove;
          tradeEdgeSamples++;
        }
      }
      offset += days;
    }
    const accuracy = total ? (hits / total) * 100 : 0;
    const calibration = total
      ? calibrationTotal / total
      : 50;
    return {
      total,
      hits,
      accuracy,
      calibration,
      confidentMisses,
      tradeEdge: tradeEdgeSamples ? tradeEdgeTotal / tradeEdgeSamples : 0,
      tradeEdgeSamples,
    };
  }, [actions, initialVisibleCount, market, normalized]);
  const decisionReplay = useMemo(
    () => buildDecisionReplay(actions, stock, normalized, initialVisibleCount),
    [actions, initialVisibleCount, normalized, stock],
  );
  const resultShareMarks = useMemo(
    () =>
      feedbackHistory.length
        ? feedbackHistory.map((item) => item.calibration)
        : decisionReplay.map((item) => (item.matched ? 75 : 30)),
    [decisionReplay, feedbackHistory],
  );
  const resultComparisonProof = shareComparisonHook(
    scoreboard?.playerScore?.percentile,
    locale,
  );
  const evidenceStreak = useMemo(() => {
    let streak = 0;
    for (let index = feedbackHistory.length - 1; index >= 0; index--) {
      if (!feedbackHistory[index].matched) break;
      streak++;
    }
    return streak;
  }, [feedbackHistory]);
  const latestCrowdLeader = crowdForecast
    ? crowdLeader(crowdForecast)
    : null;
  const crowdByRound = useMemo(
    () => new Map(crowdHistory.map((item) => [item.round, item])),
    [crowdHistory],
  );
  const crowdComparison = useMemo(() => {
    let rounds = 0;
    let agreements = 0;
    let contrarianCalls = 0;
    let contrarianWins = 0;
    let beatCrowd = 0;
    let largestSample = 0;
    for (const item of decisionReplay) {
      if (!item.outlook || item.matched == null) continue;
      const crowd = crowdByRound.get(item.round);
      if (!crowd || crowd.sampleSize < 2) continue;
      const leader = crowdLeader(crowd);
      if (!leader) continue;
      rounds++;
      largestSample = Math.max(largestSample, crowd.sampleSize);
      if (item.outlook === leader) agreements++;
      else {
        contrarianCalls++;
        if (item.matched) contrarianWins++;
      }
      if (item.matched && leader !== item.actual) beatCrowd++;
    }
    return {
      rounds,
      agreements,
      contrarianCalls,
      contrarianWins,
      beatCrowd,
      largestSample,
    };
  }, [crowdByRound, decisionReplay]);
  const scenarioEvaluation = useMemo(() => {
    if (!activeScenario) return null;
    const durationCheck = {
      label: `完成至少 ${activeDifficulty.days} 个交易日`,
      passed: advancedDays >= activeDifficulty.days,
      value: `${advancedDays} 日`,
    };
    const riskCheck = {
      label: `最大回撤不低于 ${activeDifficulty.drawdown}%`,
      passed: maxDrawdown >= activeDifficulty.drawdown,
      value: `${maxDrawdown.toFixed(1)}%`,
    };
    const accuracyCheck = {
      label: `概率校准达到 ${activeDifficulty.calibration}`,
      passed:
        decisionStats.total >= 3 &&
        decisionStats.calibration >= activeDifficulty.calibration,
      value: decisionStats.total
        ? decisionStats.calibration.toFixed(0)
        : "无样本",
    };
    const frequency = (trades / Math.max(1, advancedDays)) * 20;
    const focusCheck =
      session.scenario === "reversal"
        ? {
            label: "高信心误判不超过 1 次",
            passed:
              decisionStats.confidentMisses <= 1 && decisionStats.total >= 3,
            value: `${decisionStats.confidentMisses} 次`,
          }
        : session.scenario === "volatile"
          ? {
              label: "每 20 日成交不超过 6 次",
              passed: frequency <= 6,
              value: `${frequency.toFixed(1)} 次`,
            }
          : {
              label: `超额收益达到 ${activeDifficulty.excess >= 0 ? "+" : ""}${activeDifficulty.excess}%`,
              passed: excess >= activeDifficulty.excess,
              value: `${excess >= 0 ? "+" : ""}${excess.toFixed(1)}%`,
            };
    const checks = [durationCheck, riskCheck, accuracyCheck, focusCheck];
    return {
      checks,
      passed: checks.every((check) => check.passed),
      completed: checks.filter((check) => check.passed).length,
    };
  }, [
    activeDifficulty,
    activeScenario,
    advancedDays,
    decisionStats,
    excess,
    maxDrawdown,
    session.scenario,
    trades,
  ]);
  const allowedTrades = Math.max(4, Math.ceil(advancedDays / 10) + 1);
  const peakExposure = Math.max(0, ...exposureHistory);
  const processScores = useMemo(() => {
    const risk = clamp(100 + maxDrawdown * 6, 0, 100);
    const calibration = decisionStats.calibration;
    const execution = decisionStats.tradeEdgeSamples
      ? clamp(50 + decisionStats.tradeEdge * 6, 0, 100)
      : 50;
    const discipline = clamp(
      100 -
        Math.max(0, trades - allowedTrades) * 12 -
        Math.max(0, peakExposure - 85) * 0.6,
      35,
      100,
    );
    const performance = clamp(50 + excess * 2, 0, 100);
    return { risk, calibration, execution, discipline, performance };
  }, [
    allowedTrades,
    decisionStats.calibration,
    decisionStats.tradeEdge,
    decisionStats.tradeEdgeSamples,
    excess,
    maxDrawdown,
    peakExposure,
    trades,
  ]);
  const skillScore = Math.round(
    processScores.risk * 0.3 +
      processScores.calibration * 0.3 +
      processScores.execution * 0.1 +
      processScores.discipline * 0.25 +
      processScores.performance * 0.05,
  );
  useEffect(() => {
    if (
      !isMarketRun ||
      !marketRunProgressLoadedRef.current ||
      !finished ||
      !resultOpen
    )
      return;
    const current = parseMarketRunProgress(
      safeLocalStorage.getItem(marketRunStorageKey(market)),
      market,
    );
    const next = recordMarketRunStage(current, session.sessionId, skillScore);
    if (next === current) return;
    safeLocalStorage.setItem(marketRunStorageKey(market), JSON.stringify(next));
    const timer = window.setTimeout(() => setMarketRunProgress(next), 0);
    if (playerId) {
      trackActivationEvent(playerId, "run_stage_complete", "run");
      if (next.scores.length === MARKET_RUN_STAGES.length)
        trackActivationEvent(playerId, "run_complete", "run");
    }
    return () => window.clearTimeout(timer);
  }, [
    finished,
    isMarketRun,
    market,
    playerId,
    resultOpen,
    session.sessionId,
    skillScore,
  ]);
  useEffect(() => {
    if (!finished || !resultOpen) return;
    const milestone = celebrationMilestone({
      isMarketRun,
      marketRunFinished,
      isDaily: gameMode === "daily",
      dailySettled: scoreStatus === "done",
      dailyPercentile: scoreboard?.playerScore?.percentile,
      duelWon: Boolean(
        scoreboard?.playerScore &&
          scoreboard.opponent &&
          scoreboard.playerScore.score > scoreboard.opponent.score,
      ),
      streakGuardEarned: streakProtection.freezeEarnedToday,
      trainingMastered: Boolean(activeScenario && scenarioEvaluation?.passed),
      sessionChartCount: sessionChainCount,
      guidedFirstChart: guidedRunActive,
    });
    if (!milestone) return;
    const celebrationKey = `${session.sessionId}:${milestone}`;
    if (celebrationSeenRef.current.has(celebrationKey)) return;
    celebrationSeenRef.current.add(celebrationKey);
    setCelebration(milestone);
    if (isPlatformCelebration(milestone))
      void reportPlatformHappyTime();
    if (playerId) {
      trackActivationEvent(
        playerId,
        "milestone_celebration",
        isMarketRun
          ? "run"
          : initialCrewCode
            ? "crew"
            : initialDuel
              ? "duel"
              : "direct",
      );
    }
  }, [
    activeScenario,
    finished,
    gameMode,
    guidedRunActive,
    initialCrewCode,
    initialDuel,
    isMarketRun,
    marketRunFinished,
    playerId,
    resultOpen,
    scenarioEvaluation?.passed,
    scoreboard?.opponent,
    scoreboard?.playerScore,
    scoreStatus,
    session.sessionId,
    sessionChainCount,
    streakProtection.freezeEarnedToday,
  ]);
  useEffect(() => {
    if (!celebration) return;
    const timer = window.setTimeout(() => setCelebration(null), 4400);
    return () => window.clearTimeout(timer);
  }, [celebration]);
  const decisionStyle = useMemo(
    () =>
      decisionStyleFor(
        {
          calibration: decisionStats.calibration,
          risk: processScores.risk,
          discipline: processScores.discipline,
          accuracy: decisionStats.accuracy,
          confidentMisses: decisionStats.confidentMisses,
          trades,
          peakExposure,
          contrarianCalls: crowdComparison.contrarianCalls,
          contrarianWins: crowdComparison.contrarianWins,
        },
        locale,
      ),
    [
      crowdComparison.contrarianCalls,
      crowdComparison.contrarianWins,
      decisionStats.accuracy,
      decisionStats.calibration,
      decisionStats.confidentMisses,
      locale,
      peakExposure,
      processScores.discipline,
      processScores.risk,
      trades,
    ],
  );
  const weakestSkill = (
    [
      { key: "risk", label: "风险控制", scenario: "crash" },
      { key: "calibration", label: "概率校准", scenario: "reversal" },
      { key: "execution", label: "执行质量", scenario: "trend" },
      { key: "discipline", label: "交易纪律", scenario: "volatile" },
      { key: "performance", label: "风险调整收益", scenario: "trend" },
    ] as const
  ).reduce((weakest, item) =>
    processScores[item.key] < processScores[weakest.key] ? item : weakest,
  );
  const deepProfile = useMemo(
    () =>
      buildTradeAnalysis({
        locale,
        candles: normalized.slice(0, visibleCount),
        markers: tradeMarkers,
        equityHistory,
        exposureHistory,
        advancedDays,
        returnRate,
        benchmark,
        excess,
        maxDrawdown,
      }),
    [
      advancedDays,
      benchmark,
      equityHistory,
      excess,
      exposureHistory,
      maxDrawdown,
      locale,
      normalized,
      returnRate,
      tradeMarkers,
      visibleCount,
    ],
  );
  const profile = { title: deepProfile.title, text: deepProfile.summary };

  useEffect(() => {
    if (initialUrlHandledRef.current) return;
    initialUrlHandledRef.current = true;
    const localPlayerId = safeLocalStorage.getItem("mangpan-player-id");
    const hasPriorActivity = Boolean(
      safeLocalStorage.getItem("mangpan-active-session-us") ||
      safeLocalStorage.getItem("mangpan-active-session-cn") ||
      safeLocalStorage.getItem("mangpan-run-active-session-us") ||
      safeLocalStorage.getItem("mangpan-run-active-session-cn") ||
      safeLocalStorage.getItem("mangpan-market-run-us") ||
      safeLocalStorage.getItem("mangpan-market-run-cn") ||
      safeLocalStorage.getItem("mangpan-scenario-progress") ||
      safeLocalStorage.getItem("mangpan-player-name") ||
      safeLocalStorage.getItem("mangpan-locale"),
    );
    const onboardingComplete =
      safeLocalStorage.getItem(ONBOARDING_STORAGE_KEY) === "complete" ||
      hasPriorActivity;
    let id = initialIdentity?.playerId || localPlayerId;
    if (!id) {
      id = crypto.randomUUID();
      safeLocalStorage.setItem("mangpan-player-id", id);
    }
    if (initialIdentity) safeLocalStorage.setItem("mangpan-player-id", id);
    const storedNickname =
      safeLocalStorage.getItem("mangpan-player-name") ||
      (safeLocalStorage.getItem("mangpan-locale") === "zh"
        ? `盲盘客${id.slice(-4).toUpperCase()}`
        : `Reader-${id.slice(-4).toUpperCase()}`);
    let storedProgress: Record<string, number> = {};
    try {
      storedProgress = JSON.parse(
        safeLocalStorage.getItem("mangpan-scenario-progress") || "{}",
      ) as Record<string, number>;
    } catch {
      storedProgress = {};
    }
    const params = new URLSearchParams(location.search);
    const challenger = initialDuel?.code || params.get("duel") || "";
    const duelDate = initialDuel?.date || params.get("date");
    queueMicrotask(() => {
      if (initialGuide) {
        setRecordView(true);
        setRevealDays(3);
        setOnboardingStep(1);
      }
      if (
        duelDate === today &&
        /^[A-Z0-9]{8,12}$/i.test(challenger)
      ) {
        setDuelCode(challenger.toUpperCase());
        setDuelGuidePending(!onboardingComplete);
        setDuelInviteOpen(true);
      }
      setPlayerId(id);
      setNickname(storedNickname);
      setScenarioProgress(storedProgress);
    });
  }, [initialDuel?.code, initialDuel?.date, initialGuide, initialIdentity, initialMode, today]);

  useEffect(() => {
    if (!playerId) return;
    let cancelled = false;
    const query = new URLSearchParams({ date: today, market, playerId });
    if (duelCode) query.set("duel", duelCode);
    fetch(`/api/scores?${query}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("load failed");
        const next = (await response.json()) as Scoreboard;
        if (!cancelled) {
          setScoreboard(next);
          if (next.stats?.training) {
            setTrainingProfile(next.stats.training);
            setScenarioProgress(next.stats.training.progress);
            safeLocalStorage.setItem(
              "mangpan-scenario-progress",
              JSON.stringify(next.stats.training.progress),
            );
          }
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [duelCode, market, playerId, today]);

  useEffect(() => {
    if (!playerId || !initialDuel?.code) return;
    trackDuelEvent(
      initialDuel.code,
      playerId,
      "view",
      initialDuel.source,
    );
  }, [initialDuel?.code, initialDuel?.source, playerId]);

  useEffect(() => {
    if (!playerId || !initialDuel?.code || !actions.length) return;
    trackDuelEvent(
      initialDuel.code,
      playerId,
      "start",
      initialDuel.source,
    );
  }, [actions.length, initialDuel?.code, initialDuel?.source, playerId]);

  useEffect(() => {
    if (!playerId || sessionThreeMinutesTrackedRef.current) return;
    const source = initialDuel
      ? "duel"
      : initialGuide
        ? "lobby"
        : isMarketRun
          ? "run"
          : "direct";
    const trackIfVisible = () => {
      if (document.visibilityState !== "visible" || sessionThreeMinutesTrackedRef.current)
        return;
      sessionThreeMinutesTrackedRef.current = true;
      trackActivationEvent(playerId, "session_three_minutes", source);
    };
    const timer = window.setTimeout(trackIfVisible, 180_000);
    document.addEventListener("visibilitychange", trackIfVisible);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", trackIfVisible);
    };
  }, [initialDuel, initialGuide, isMarketRun, playerId]);

  useEffect(() => {
    if (!playerId || !guidedRunActive) return;
    trackActivationEvent(
      playerId,
      "guide_start",
      initialDuel ? "duel" : initialGuide ? "lobby" : "direct",
    );
  }, [guidedRunActive, initialDuel, initialGuide, playerId]);

  useEffect(() => {
    if (!isMarketRun || !playerId || marketRunStartTrackedRef.current) return;
    marketRunStartTrackedRef.current = true;
    trackActivationEvent(playerId, "run_start", "run");
  }, [isMarketRun, playerId]);
  useEffect(() => {
    if (!isEndlessMode || !playerId || !actions.length || endlessStartTrackedRef.current)
      return;
    endlessStartTrackedRef.current = true;
    trackActivationEvent(
      playerId,
      "endless_start",
      initialCrewCode ? "crew" : initialDuel ? "duel" : "direct",
    );
  }, [actions.length, initialCrewCode, initialDuel, isEndlessMode, playerId]);
  useEffect(() => {
    if (!isEndlessMode || !playerId || !finished || !resultOpen) return;
    if (endlessCompletedSessionsRef.current.has(session.sessionId)) return;
    endlessCompletedSessionsRef.current.add(session.sessionId);
    trackActivationEvent(
      playerId,
      "endless_complete",
      initialCrewCode ? "crew" : initialDuel ? "duel" : "direct",
    );
  }, [finished, initialCrewCode, initialDuel, isEndlessMode, playerId, resultOpen, session.sessionId]);

  useEffect(() => {
    if (!playerId || !guidedRunActive || !forecastTouched) return;
    trackActivationEvent(
      playerId,
      "guide_forecast",
      initialDuel ? "duel" : initialGuide ? "lobby" : "direct",
    );
  }, [forecastTouched, guidedRunActive, initialDuel, initialGuide, playerId]);

  useEffect(() => {
    if (!playerId || !guidedRunActive || !actions.length) return;
    trackActivationEvent(
      playerId,
      "guide_reveal",
      initialDuel ? "duel" : initialGuide ? "lobby" : "direct",
    );
  }, [actions.length, guidedRunActive, initialDuel, initialGuide, playerId]);

  useEffect(() => {
    if (!playerId || gameMode !== "daily" || !actions.length) return;
    trackActivationEvent(
      playerId,
      "daily_first_move",
      initialCrewCode ? "crew" : initialDuel ? "duel" : "direct",
    );
  }, [actions.length, gameMode, initialCrewCode, initialDuel, playerId]);

  useEffect(() => {
    if (!playerId || guidedRunActive || actions.length < 2) return;
    trackActivationEvent(
      playerId,
      gameMode === "daily" ? "daily_second_move" : "practice_second_move",
      initialCrewCode ? "crew" : initialDuel ? "duel" : "direct",
    );
  }, [actions.length, gameMode, guidedRunActive, initialCrewCode, initialDuel, playerId]);

  useEffect(() => {
    if (!playerId || gameMode !== "daily" || scoreStatus !== "done") return;
    trackActivationEvent(
      playerId,
      "daily_complete",
      initialCrewCode ? "crew" : initialDuel ? "duel" : "direct",
    );
  }, [gameMode, initialCrewCode, initialDuel, playerId, scoreStatus]);

  useEffect(() => {
    if (!initialCrewCode || !playerId || scoreStatus === "loading") return;
    void fetch(
      `/api/crews?code=${encodeURIComponent(initialCrewCode)}&playerId=${encodeURIComponent(playerId)}`,
    )
      .then((response) => response.json())
      .then((payload: { crew?: CrewSummary }) => {
        if (payload.crew?.isMember) setCrewResult(payload.crew);
      })
      .catch(() => undefined);
  }, [initialCrewCode, playerId, scoreStatus]);

  useEffect(() => {
    if (
      !playerId ||
      !finished ||
      gameMode !== "daily" ||
      scoreStatus !== "idle" ||
      submissionRef.current
    )
      return;
    submissionRef.current = true;
    queueMicrotask(() => setScoreStatus("loading"));
    fetch("/api/scores", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        date: today,
        market,
        playerId,
        nickname,
        sessionId: session.sessionId,
        duelCode: duelCode || undefined,
        duelSource: duelCode ? initialDuel?.source ?? "direct" : undefined,
      }),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("submit failed");
        const next = (await response.json()) as Scoreboard;
        setScoreboard(next);
        setScoreStatus("done");
      })
      .catch(() => {
        submissionRef.current = false;
        setScoreStatus("error");
      });
  }, [
    duelCode,
    finished,
    gameMode,
    initialDuel?.source,
    market,
    nickname,
    playerId,
    scoreStatus,
    session.sessionId,
    today,
  ]);

  const platformDuelUrl = useCallback(async (code: string) => {
    const standaloneUrl = `${location.origin}/d/${encodeURIComponent(code)}`;
    const url = await createPlatformDuelShareUrl(code, standaloneUrl);
    if (!url) throw new Error("platform invite unavailable");
    return url;
  }, []);

  const prepareDuelShareUrl = useCallback(async () => {
    if (gameMode !== "daily") {
      const url = location.href;
      setDuelShareUrl(url);
      setShareSetupStatus("ready");
      return url;
    }
    if (duelShareUrl) return duelShareUrl;
    const shareCode = scoreboard?.shareDuel?.code ?? duelCode;
    if (shareCode) {
      const url = await platformDuelUrl(shareCode);
      setDuelShareUrl(url);
      setShareSetupStatus("ready");
      return url;
    }
    if (!playerId) throw new Error("player unavailable");
    if (duelSharePromiseRef.current) return duelSharePromiseRef.current;
    setShareSetupStatus("loading");
    const request = fetch("/api/duels", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ date: today, market, playerId }),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("duel unavailable");
        const duel = (await response.json()) as { code: string };
        const url = await platformDuelUrl(duel.code);
        setDuelShareUrl(url);
        setShareSetupStatus("ready");
        return url;
      })
      .catch((error) => {
        duelSharePromiseRef.current = null;
        setShareSetupStatus("error");
        throw error;
      });
    duelSharePromiseRef.current = request;
    return request;
  }, [
    duelCode,
    duelShareUrl,
    gameMode,
    market,
    platformDuelUrl,
    playerId,
    scoreboard?.shareDuel?.code,
    today,
  ]);

  useEffect(() => {
    if (
      (gameMode !== "daily" && !isEndlessMode) ||
      scoreStatus !== "done" ||
      duelShareUrl ||
      shareSetupStatus !== "idle"
    )
      return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void prepareDuelShareUrl().catch(() => undefined);
    });
    return () => {
      cancelled = true;
    };
  }, [
    duelShareUrl,
    gameMode,
    isEndlessMode,
    prepareDuelShareUrl,
    scoreStatus,
    shareSetupStatus,
  ]);

  const resetSession = useCallback((nextSession: ChallengeSession) => {
    submissionRef.current = false;
    endlessStartTrackedRef.current = false;
    const restored = restoreGameState(nextSession);
    setMarket(nextSession.market);
    setGameMode(nextSession.mode);
    setSession(nextSession);
    setStock(nextSession.stock);
    setVisibleCount(restored.visibleCount);
    setRound(restored.round);
    setCash(restored.cash);
    setShares(restored.shares);
    setMode("buy");
    setAllocation(1);
    setOrderInputMode("allocation");
    setQuantityInput("");
    setRevealDays(3);
    setOutlook("up");
    setThesis("trend");
    setConfidence(2);
    setForecastTouched(false);
    setRecordView(
      (nextSession.mode === "daily" || nextSession.mode === "sprint") ||
        nextSession.scenario !== "random",
    );
    setTrades(restored.trades);
    setFeesPaid(restored.feesPaid);
    setSlippagePaid(restored.slippagePaid);
    setTradeMarkers(restored.markers);
    setEquityHistory(restored.equityHistory);
    setExposureHistory(restored.exposureHistory);
    setActions(nextSession.actions);
    setFinished(false);
    setResultOpen(false);
    setCelebration(null);
    setAnalysisOpen(false);
    setLastFeedback(restored.feedbackHistory.at(-1) ?? null);
    setDecisionRevealOpen(false);
    setFeedbackHistory(restored.feedbackHistory);
    setCrowdHistory(nextSession.crowdForecasts ?? []);
    setRevealPulse(0);
    setShareStatus("");
    setCardStatus("");
    setDuelRoomShareStatus("");
    setDuelShareUrl("");
    setShareSetupStatus("idle");
    duelSharePromiseRef.current = null;
    setReplayLimit(8);
    setScoreStatus("idle");
    setScoreboard(null);
    safeLocalStorage.setItem(
      activeSessionStorageKey(nextSession.market),
      nextSession.sessionId,
    );
  }, [activeSessionStorageKey]);

  const challengeRequest = useCallback(
    (
      nextMode: GameMode,
      nextMarket: MarketKind,
      scenario: ScenarioKind,
      difficulty: ScenarioDifficulty,
    ) => {
      const key = `${nextMode}:${nextMarket}:${scenario}:${difficulty}`;
      const cached = challengeRequestCacheRef.current.get(key);
      if (cached) return { key, request: cached };
      const query = new URLSearchParams({
        mode: nextMode,
        seed: crypto.randomUUID(),
        market: nextMarket,
        scenario,
        difficulty,
        playerId,
      });
      const request = fetch(`/api/challenge?${query}`).then(async (response) => {
        if (!response.ok) throw new Error("challenge load failed");
        return (await response.json()) as ChallengeSession;
      });
      challengeRequestCacheRef.current.set(key, request);
      request.catch(() => {
        if (challengeRequestCacheRef.current.get(key) === request)
          challengeRequestCacheRef.current.delete(key);
      });
      return { key, request };
    },
    [playerId],
  );

  const takeChallenge = useCallback(
    async (
      nextMode: GameMode,
      nextMarket: MarketKind,
      scenario: ScenarioKind,
      difficulty: ScenarioDifficulty,
    ) => {
      const pending = challengeRequest(
        nextMode,
        nextMarket,
        scenario,
        difficulty,
      );
      try {
        return await pending.request;
      } finally {
        if (
          challengeRequestCacheRef.current.get(pending.key) === pending.request
        )
          challengeRequestCacheRef.current.delete(pending.key);
      }
    },
    [challengeRequest],
  );

  const prefetchChallenge = (
    nextMode: GameMode,
    nextMarket: MarketKind,
    scenario: ScenarioKind = "random",
    difficulty: ScenarioDifficulty = "standard",
  ) => {
    if (!playerId || challengeLoading) return;
    void challengeRequest(nextMode, nextMarket, scenario, difficulty).request;
  };

  useEffect(() => {
    if (initialGuide || !playerId || resumeAttemptRef.current.has(market)) return;
    resumeAttemptRef.current.add(market);
    const storageKey = activeSessionStorageKey(market);
    const savedSession = safeLocalStorage.getItem(storageKey);
    if (savedSession === session.sessionId) return;
    if (!savedSession && (isMarketRun || !initialIdentity)) return;
    const query = savedSession
      ? new URLSearchParams({ sessionId: savedSession, playerId })
      : new URLSearchParams({ resume: "latest", market, playerId });
    fetch(`/api/challenge?${query}`)
      .then(async (response) => {
        if (response.status === 204) return null;
        if (!response.ok) throw new Error("resume failed");
        return (await response.json()) as ChallengeSession;
      })
      .then((restored) => {
        const expectedMode =
          initialMode === "daily"
            ? "daily"
            : initialMode === "sprint"
              ? "sprint"
              : initialMode === "endless"
                ? "endless"
              : "practice";
        if (restored?.mode === expectedMode) resetSession(restored);
      })
      .catch(() => safeLocalStorage.removeItem(storageKey));
  }, [activeSessionStorageKey, initialGuide, initialIdentity, initialMode, isMarketRun, market, playerId, resetSession, session.sessionId]);

  useEffect(() => {
    if (!playerId || !actions.length || finished) return;
    safeLocalStorage.setItem(
      activeSessionStorageKey(market),
      session.sessionId,
    );
  }, [actions.length, activeSessionStorageKey, finished, market, playerId, session.sessionId]);

  const resetGame = async (
    nextMode: GameMode,
    nextMarket = market,
    scenario: ScenarioKind = "random",
    difficulty: ScenarioDifficulty = "standard",
  ) => {
    setChallengeLoading(true);
    try {
      resetSession(
        await takeChallenge(nextMode, nextMarket, scenario, difficulty),
      );
      setTrainingOpen(false);
    } finally {
      setChallengeLoading(false);
    }
  };

  const continueAfterResult = async () => {
    if (challengeLoading) return;
    if (playerId)
      trackActivationEvent(playerId, "result_next_chart", "direct");
    history.replaceState(null, "", `/practice?market=${market}`);
    await resetGame("practice", market, "random", "standard");
  };

  const startMarketRunStage = useCallback(
    async (stageIndex: number) => {
      const nextStage = MARKET_RUN_STAGES[Math.max(
        0,
        Math.min(MARKET_RUN_STAGES.length - 1, stageIndex),
      )];
      setChallengeLoading(true);
      try {
        resetSession(
          await takeChallenge(
            "practice",
            market,
            nextStage.scenario,
            nextStage.difficulty,
          ),
        );
        history.replaceState(null, "", `/run?market=${market}`);
      } finally {
        setChallengeLoading(false);
      }
    },
    [market, resetSession, takeChallenge],
  );

  const continueMarketRun = async () => {
    if (!isMarketRun || challengeLoading) return;
    if (marketRunFinished) {
      const fresh = newMarketRunProgress(market);
      safeLocalStorage.setItem(marketRunStorageKey(market), JSON.stringify(fresh));
      safeLocalStorage.removeItem(marketRunSessionStorageKey(market));
      setMarketRunProgress(fresh);
      await startMarketRunStage(0);
      return;
    }
    await startMarketRunStage(marketRunCompletedStages);
  };

  useEffect(() => {
    if (
      !isMarketRun ||
      !playerId ||
      !marketRunProgressLoadedRef.current ||
      challengeLoading ||
      finished ||
      actions.length ||
      marketRunCompletedStages === 0 ||
      marketRunFinished ||
      safeLocalStorage.getItem(marketRunSessionStorageKey(market))
    )
      return;
    const expected = MARKET_RUN_STAGES[marketRunCompletedStages];
    if (
      session.scenario === expected.scenario &&
      session.difficulty === expected.difficulty
    )
      return;
    const timer = window.setTimeout(() => {
      void startMarketRunStage(marketRunCompletedStages);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [
    actions.length,
    challengeLoading,
    finished,
    isMarketRun,
    market,
    marketRunCompletedStages,
    marketRunFinished,
    playerId,
    session.difficulty,
    session.scenario,
    startMarketRunStage,
  ]);

  const switchStock = async () => {
    if (challengeLoading || isRevealing || finished) return;
    if (
      (gameMode === "daily" || actions.length > 0) &&
      !window.confirm(
        gameMode === "daily"
          ? locale === "en"
            ? "Switch stocks? This will end today's challenge and start a random practice run. Today's leaderboard score will be forfeited."
            : "更换股票将结束今日挑战并转入随机练习，今天将不能再提交排行榜成绩。继续吗？"
          : locale === "en"
            ? "Switch stocks? This run will not count toward scores, XP, or training progress."
            : "换一只股票？本次练习不会计分，也不会获得 XP 或训练进度。",
      )
    )
      return;
    setChallengeLoading(true);
    try {
      const abandoned = fetch("/api/challenge", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId: session.sessionId,
          playerId,
        }),
      });
      safeLocalStorage.removeItem(activeSessionStorageKey(market));
      const nextScenario = gameMode === "daily" ? "random" : session.scenario;
      const nextDifficulty =
        gameMode === "daily" ? "standard" : session.difficulty;
      const nextSession = takeChallenge(
        "practice",
        market,
        nextScenario,
        nextDifficulty,
      );
      const [abandonedResponse, loadedSession] = await Promise.all([
        abandoned,
        nextSession,
      ]);
      if (!abandonedResponse.ok) throw new Error("challenge abandon failed");
      resetSession(loadedSession);
      setTrainingOpen(false);
      setDuelCode("");
      history.replaceState(
        null,
        "",
        location.pathname.startsWith("/d/") ? "/" : location.pathname,
      );
    } finally {
      setChallengeLoading(false);
    }
  };

  const changeMarket = (nextMarket: MarketKind) => {
    if (nextMarket === market || challengeLoading || isRevealing) return;
    safeLocalStorage.setItem("mangpan-market", nextMarket);
    setDuelCode("");
    void resetGame(gameMode, nextMarket, session.scenario, session.difficulty);
    history.replaceState(
      null,
      "",
      location.pathname.startsWith("/d/")
        ? `/daily?market=${nextMarket}`
        : `${location.pathname}?market=${nextMarket}`,
    );
  };

  const completeOnboarding = (completed: boolean) => {
    if (
      completed &&
      playerId &&
      guidedRunActive &&
      !guideCompleteTrackedRef.current
    ) {
      guideCompleteTrackedRef.current = true;
      trackActivationEvent(
        playerId,
        "guide_complete",
        initialDuel ? "duel" : initialGuide ? "lobby" : "direct",
      );
    }
    safeLocalStorage.setItem(ONBOARDING_STORAGE_KEY, "complete");
    setOnboardingStep(0);
    setGuidedRunActive(false);
    const params = new URLSearchParams(location.search);
    if (params.has("guide")) {
      params.delete("guide");
      history.replaceState(
        null,
        "",
        `${location.pathname}${params.size ? `?${params}` : ""}`,
      );
    }
  };

  const enterDailyAfterGuide = async () => {
    if (playerId) {
      trackActivationEvent(
        playerId,
        "guide_daily_continue",
        initialGuide ? "lobby" : "direct",
      );
    }
    completeOnboarding(true);
    history.replaceState(null, "", `/daily?market=${market}`);
    await resetGame("daily", market, "random", "standard");
  };

  const acceptDuelInvite = () => {
    setDuelInviteOpen(false);
    if (!duelGuidePending) return;
    setDuelGuidePending(false);
    setRecordView(true);
    setRevealDays(3);
    setOnboardingStep(1);
    setGuidedRunActive(true);
  };

  const leaveDuel = () => {
    setDuelInviteOpen(false);
    setDuelCode("");
    setScoreboard((value) =>
      value ? { ...value, opponent: null, duelCode: null } : value,
    );
    history.replaceState(null, "", "/");
  };

  const startQuiz = async (focus?: QuizScenario) => {
    if (!playerId || quizLoading) return;
    setQuizLoading(true);
    try {
      const query = new URLSearchParams({
        market,
        difficulty: selectedDifficulty,
        seed: crypto.randomUUID(),
        playerId,
      });
      if (focus) query.set("focus", focus);
      const response = await fetch(`/api/quiz?${query}`);
      if (!response.ok) throw new Error("quiz load failed");
      setPatternQuiz((await response.json()) as PatternQuiz);
      setQuizAnswer(null);
      setQuizConfidence(2);
      setQuizResult(null);
      setTrainingOpen(false);
      setQuizOpen(true);
    } finally {
      setQuizLoading(false);
    }
  };

  const submitQuiz = async () => {
    if (!patternQuiz || !quizAnswer || quizResult || quizLoading) return;
    setQuizLoading(true);
    try {
      const response = await fetch("/api/quiz", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          quizId: patternQuiz.quizId,
          answer: quizAnswer,
          confidence: quizConfidence,
          playerId,
        }),
      });
      if (!response.ok) throw new Error("quiz submit failed");
      const result = (await response.json()) as PatternQuizResult;
      setQuizResult(result);
      setTrainingProfile(result.trainingProfile);
      setScenarioProgress(result.trainingProfile.progress);
      setScoreboard((value) =>
        value?.stats
          ? {
              ...value,
              stats: { ...value.stats, training: result.trainingProfile },
            }
          : value,
      );
    } finally {
      setQuizLoading(false);
    }
  };

  const finishGame = async (force = false) => {
    if ((!force && isRevealing) || finished || dailyExpired) return;
    setIsRevealing(true);
    try {
      const response = await fetch("/api/challenge", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: session.sessionId, playerId }),
      });
      if (!response.ok) throw new Error("reveal failed");
      const revealed = (await response.json()) as {
        stock: StockSample;
        actions: ReplayAction[];
        visibleCount: number;
        trainingResult: null | {
          passed: boolean;
          score: number;
          scenario: ScenarioKind;
          difficulty: ScenarioDifficulty;
        };
        trainingProfile: TrainingProfile | null;
      };
      setStock(revealed.stock);
      setActions(revealed.actions);
      setVisibleCount(revealed.visibleCount);
      setSession((value) => ({
        ...value,
        stock: revealed.stock,
        remainingBars: Math.max(0, value.totalBars - revealed.visibleCount),
        decisionsUsed: revealed.actions.length,
      }));
      if (revealed.trainingProfile) {
        setTrainingProfile(revealed.trainingProfile);
        setScenarioProgress(revealed.trainingProfile.progress);
        safeLocalStorage.setItem(
          "mangpan-scenario-progress",
          JSON.stringify(revealed.trainingProfile.progress),
        );
        setScoreboard((value) =>
          value?.stats
            ? {
                ...value,
                stats: { ...value.stats, training: revealed.trainingProfile! },
              }
            : value,
        );
      }
      safeLocalStorage.removeItem(activeSessionStorageKey(market));
      setSessionChainCount((value) => value + 1);
      setFinished(true);
      setResultOpen(true);
    } finally {
      setIsRevealing(false);
    }
  };
  const advance = async (action: "trade" | "hold") => {
    if (finished || isRevealing || remainingDays <= 0 || dailyExpired) return;
    reportPlatformGameplayStart();
    setIsRevealing(true);
    const holdingDays = Math.min(revealDays, remainingDays);
    const requestedQuantity =
      orderInputMode === "quantity" ? enteredQuantity : undefined;
    const recordedView = {
      outlook,
      thesis,
      confidence,
      probabilities: probabilityForecast(outlook, confidence),
    };
    const replayAction: ReplayAction =
      action === "hold"
        ? {
            kind: "hold",
            days: holdingDays as ReplayAction["days"],
            ...recordedView,
          }
        : {
            kind: mode,
            ...(requestedQuantity !== undefined
              ? { quantity: requestedQuantity }
              : { allocation }),
            days: holdingDays as ReplayAction["days"],
            ...recordedView,
          };
    const response = await fetch("/api/challenge", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionId: session.sessionId,
        action: replayAction,
        playerId,
      }),
    });
    if (!response.ok) {
      setIsRevealing(false);
      return;
    }
    const advanced = (await response.json()) as AdvanceResponse;
    if (advanced.dailyMission)
      setTrainingProfile((value) =>
        value ? { ...value, daily: advanced.dailyMission! } : value,
      );
    if (advanced.crowdForecast)
      setCrowdHistory((history) => [
        ...history.filter(
          (item) => item.round !== advanced.crowdForecast!.round,
        ),
        advanced.crowdForecast!,
      ]);
    const factor = 100 / stock.candles[initialVisibleCount - 1].close;
    const normalizedNew = advanced.candles.map((candle) => ({
      ...candle,
      open: candle.open * factor,
      close: candle.close * factor,
      high: candle.high * factor,
      low: candle.low * factor,
    }));
    const feedback = hasRecordedView(advanced.action)
      ? evaluateDecision(advanced.action, normalizedNew, round + 1)
      : null;
    setStock((value) => ({
      ...value,
      candles: [...value.candles, ...advanced.candles],
    }));
    setActions((value) => [...value, advanced.action]);
    setSession((value) => ({
      ...value,
      remainingBars: advanced.remainingBars,
      decisionsUsed: advanced.decisionsUsed,
      maxDecisions: advanced.maxDecisions,
    }));
    const executionIndex = visibleCount,
      execution = normalizedNew[0].open;
    let nextCash = cash,
      nextShares = shares,
      didTrade = false,
      amount = 0,
      executedFees = 0,
      executedSlippage = 0,
      fillPrice = execution;
    if (action === "trade") {
      amount = orderQuantity({
        market,
        kind: mode,
        price: execution,
        cash,
        shares,
        allocation,
        quantity: requestedQuantity,
      });
      if (mode === "buy" && amount > 0) {
        const quote = transactionQuote({
          market,
          kind: "buy",
          referencePrice: execution,
          quantity: amount,
        });
        nextCash += quote.cashDelta;
        nextShares += amount;
        executedFees = quote.totalFees;
        executedSlippage = quote.slippageCost;
        fillPrice = quote.executionPrice;
        didTrade = true;
      }
      if (mode === "sell" && amount > 0) {
        const quote = transactionQuote({
          market,
          kind: "sell",
          referencePrice: execution,
          quantity: amount,
        });
        nextShares -= amount;
        nextCash += quote.cashDelta;
        executedFees = quote.totalFees;
        executedSlippage = quote.slippageCost;
        fillPrice = quote.executionPrice;
        didTrade = true;
      }
      setOrderInputMode("allocation");
      setQuantityInput("");
    }
    if (didTrade)
      setTradeMarkers((value) => [
        ...value,
        {
          index: executionIndex,
          type: mode === "buy" ? "B" : "S",
          price: fillPrice,
          quantity: amount,
          round,
        },
      ]);
    setCash(nextCash);
    setShares(nextShares);
    const pathEquities: number[] = [],
      pathExposures: number[] = [];
    for (let step = 1; step <= advanced.candles.length; step++) {
      await delay(step === 1 ? 170 : 260);
      const stepPrice = normalizedNew[step - 1].close;
      const stepEquity = nextCash + nextShares * stepPrice;
      pathEquities.push(stepEquity);
      pathExposures.push(
        stepEquity > 0 ? ((nextShares * stepPrice) / stepEquity) * 100 : 0,
      );
      setVisibleCount(visibleCount + step);
    }
    const nextEquity = pathEquities[pathEquities.length - 1],
      nextRound = round + 1;
    setRound(nextRound);
    setTrades((value) => value + (didTrade ? 1 : 0));
    setFeesPaid((value) => value + executedFees);
    setSlippagePaid((value) => value + executedSlippage);
    setEquityHistory((value) => [...value, ...pathEquities]);
    setExposureHistory((value) => [...value, ...pathExposures]);
    setRevealPulse((value) => value + 1);
    if (feedback) {
      setLastFeedback(feedback);
      setFeedbackHistory((value) => [...value, feedback]);
      setDecisionRevealOpen(true);
    }
    if (requiresForecast) setForecastTouched(false);
    if (onboardingStep === 2) setOnboardingStep(3);
    setIsRevealing(false);
    if (
      advanced.finished ||
      nextEquity <= INITIAL_CASH * 0.2 ||
      (isMarketRun && advanced.decisionsUsed >= MARKET_RUN_DECISIONS)
    )
      await finishGame(true);
  };

  const resultShareCopy = () => {
    const shareCopy = SHARE_TEXT_COPY[locale];
    const marks = resultShareMarks;
    const longCycle = isEndlessMode;
    const sequence = marks
      .slice(0, DAILY_CHALLENGE_DECISIONS)
      .map((value) => (value >= 70 ? "🟩" : value >= 45 ? "🟨" : "🟥"))
      .join("");
    const shareMarket = market === "us" ? shareCopy.usStocks : shareCopy.chinaShares;
    const title = longCycle
      ? locale === "zh"
        ? "盲盘无尽长周期 · 神秘历史行情"
        : "BLIND TRADING ENDLESS · Mystery Market Run"
      : `${shareCopy.title} · ${locale === "zh" ? "神秘历史行情" : "Mystery Market Challenge"}`;
    const chainLabel =
      activeDuel && scoreboard?.shareDuel
        ? shareCopy.chain(scoreboard.shareDuel.chainDepth + 1)
        : "";
    const crowdLine = crowdComparison.rounds
      ? shareCopy.crowd(
          crowdComparison.beatCrowd,
          crowdComparison.contrarianWins,
          crowdComparison.contrarianCalls,
        )
      : "";
    const styleLine = shareCopy.style(decisionStyle.title);
    const comparisonLine = resultComparisonProof;
    const challenge = longCycle
      ? locale === "zh"
        ? "同一段隐藏长周期，不限决策次数。你能坚持读到最后吗？"
        : "One hidden long cycle, no round cap. Can you read it to the end?"
      : shareCopy.challenge;
    const text = `${title} #${today.replaceAll("-", "")} · ${shareMarket}${chainLabel}\n${sequence}\n${styleLine}${comparisonLine ? `\n${comparisonLine}` : ""}\n${shareCopy.score(skillScore, decisionStats.calibration.toFixed(0), processScores.risk.toFixed(0))}${crowdLine ? `\n${crowdLine}` : ""}\n${challenge}`;
    const compactText = longCycle
      ? `${comparisonLine ? `${comparisonLine} · ` : ""}${locale === "zh" ? `我的无尽长周期得分 ${skillScore} · ${sequence} 你能读到最后吗？` : `My Endless run scored ${skillScore} · ${sequence} Can you read one hidden cycle to the end?`}`
      : `${comparisonLine ? `${comparisonLine} · ` : ""}${shareCopy.compact(decisionStyle.title, skillScore, chainLabel, sequence)}`;
    return { compactText, text, title };
  };

  const resultChannelHref = (
    channel: Exclude<ShareChannel, "native" | "copy">,
  ) => {
    if (!duelShareUrl) return undefined;
    const copy = resultShareCopy();
    return socialShareHref(
      channel,
      duelShareUrl,
      channel === "x" || channel === "reddit" || channel === "bluesky"
        ? copy.compactText
        : copy.text,
    );
  };

  const recordDuelShare = (channel: ShareChannel) => {
    const shareCode = scoreboard?.shareDuel?.code ?? duelCode;
    if (shareCode && playerId)
      trackDuelEvent(shareCode, playerId, "share", channel);
  };

  const shareResult = async (channel: "native" | "copy") => {
    const { text, title } = resultShareCopy();
    if (
      gameMode !== "daily" &&
      currentWebGamePlatform() !== "standalone"
    ) {
      setShareStatus(
        locale === "en"
          ? "Daily challenges can be shared with friends"
          : "每日挑战可邀请好友参与",
      );
      return;
    }
    let shareUrl = location.href;
    if (gameMode === "daily") {
      if (!duelShareUrl) {
        setShareStatus(
          locale === "en" ? "Preparing challenge…" : "正在生成挑战链接…",
        );
        try {
          await prepareDuelShareUrl();
          setShareStatus(
            locale === "en"
              ? "Challenge ready · tap again to share"
              : "挑战已准备好 · 再点一次分享",
          );
        } catch {
          setShareStatus(
            locale === "en" ? "Could not prepare · tap to retry" : "准备失败 · 点击重试",
          );
        }
        return;
      }
      shareUrl = duelShareUrl;
    }
    const taggedUrl = taggedChallengeUrl(shareUrl, channel);
    try {
      if (channel === "native" && navigator.share) {
       await navigator.share({ title, text, url: taggedUrl });
       recordDuelShare("native");
        if (isEndlessMode)
          trackActivationEvent(playerId, "endless_share", "direct");
       setShareStatus(
          locale === "en" ? "Challenge sent" : "挑战已发出",
        );
      } else {
       await navigator.clipboard.writeText(`${text}\n${taggedUrl}`);
       recordDuelShare("copy");
        if (isEndlessMode)
          trackActivationEvent(playerId, "endless_share", "direct");
       setShareStatus(
          locale === "en" ? "Challenge link copied" : "挑战链接已复制",
        );
      }
    } catch (error) {
      setShareStatus(
        error instanceof DOMException && error.name === "AbortError"
          ? ""
          : locale === "en"
            ? "Could not share. Try again."
            : "生成失败，请稍后重试",
      );
    }
  };

  const installGame = async () => {
    if (!installPrompt) return;
    setInstallStatus(
      locale === "en" ? "Opening install…" : "正在打开安装…",
    );
    try {
      await installPrompt.prompt();
      await installPrompt.userChoice;
    } catch {
      // Some browsers can withdraw an install prompt after it was captured.
    } finally {
      setInstallPrompt(null);
      setInstallStatus("");
    }
  };

  const resultCardImage = (challengeUrl = duelShareUrl) =>
    createResultShareCard({
      locale,
      date: today,
      market,
      score: skillScore,
      calibration: Math.round(decisionStats.calibration),
      risk: Math.round(processScores.risk),
      percentile: scoreboard?.playerScore?.percentile,
      marks: resultShareMarks,
      challengeUrl: challengeUrl || undefined,
      decisionStyle,
      variant: resultCardVariant,
      longCycle: isEndlessMode,
    });

  const downloadResultCard = (image: Blob) => {
    const href = URL.createObjectURL(image);
    const link = document.createElement("a");
    link.href = href;
    link.download = `blind-trading-${resultCardVariant}-${today}.png`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(href), 0);
  };

  const saveResultCard = async () => {
    setCardStatus(locale === "en" ? "Preparing image…" : "正在生成图片…");
    try {
      let challengeUrl = duelShareUrl;
      if (!challengeUrl) {
        try {
          challengeUrl = await prepareDuelShareUrl();
        } catch {
          // The card remains saveable with the public game address as fallback.
        }
      }
      const image = await resultCardImage(challengeUrl);
      if (!image) throw new Error("image unavailable");
      downloadResultCard(image);
      setCardStatus(locale === "en" ? "Image saved" : "图片已保存");
    } catch {
      setCardStatus(
        locale === "en" ? "Could not create image" : "图片生成失败",
      );
    }
  };

  const shareResultCard = async () => {
    if (!duelShareUrl) {
      setCardStatus(
        locale === "en" ? "Preparing challenge…" : "正在生成挑战链接…",
      );
      try {
        await prepareDuelShareUrl();
        setCardStatus(
          locale === "en"
            ? "Challenge ready · tap again"
            : "挑战已准备好 · 再点一次",
        );
      } catch {
        setCardStatus(
          locale === "en" ? "Could not prepare · retry" : "准备失败 · 请重试",
        );
      }
      return;
    }
    setCardStatus(locale === "en" ? "Preparing image…" : "正在生成图片…");
    try {
      const image = await resultCardImage();
      if (!image) throw new Error("image unavailable");
      const file = new File(
        [image],
        `blind-trading-${resultCardVariant}-${today}.png`,
        {
          type: "image/png",
        },
      );
      const taggedUrl = taggedChallengeUrl(duelShareUrl, "native");
      const copy = resultShareCopy();
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: copy.title,
          text: `${copy.compactText}\n${taggedUrl}`,
        });
       recordDuelShare("native");
       trackActivationEvent(
         playerId,
          isEndlessMode
            ? "endless_share"
            : resultCardVariant === "style"
              ? "daily_style_card_share"
              : "daily_score_card_share",
         activeDuel ? "duel" : "direct",
       );
        setCardStatus(
          locale === "en"
            ? `${resultCardVariant === "style" ? "Style" : "Score"} card shared`
            : `${resultCardVariant === "style" ? "风格" : "成绩"}卡已分享`,
        );
        return;
      }
      downloadResultCard(image);
      try {
        await navigator.clipboard.writeText(`${copy.compactText}\n${taggedChallengeUrl(duelShareUrl, "copy")}`);
       recordDuelShare("copy");
       trackActivationEvent(
         playerId,
          isEndlessMode
            ? "endless_share"
            : resultCardVariant === "style"
              ? "daily_style_card_share"
              : "daily_score_card_share",
         activeDuel ? "duel" : "direct",
       );
        setCardStatus(
          locale === "en"
            ? "Image saved · link copied"
            : "图片已保存 · 链接已复制",
        );
      } catch {
        setCardStatus(
          locale === "en"
            ? "Image saved · copy the link below"
            : "图片已保存 · 请复制下方链接",
        );
      }
    } catch (error) {
      setCardStatus(
        error instanceof DOMException && error.name === "AbortError"
          ? ""
          : locale === "en"
            ? "Could not share image"
            : "图片分享失败",
      );
    }
  };

  const shareDuelRoom = async () => {
    const shareCode = scoreboard?.shareDuel?.code ?? duelCode;
    if (!shareCode || !scoreboard?.playerScore) return;
    const responses = scoreboard.duelRoom?.isHost
      ? scoreboard.duelRoom.responseCount
      : 0;
    const title =
      locale === "en"
        ? `${nickname} scored ${scoreboard.playerScore.score} in Blind Trading`
        : `${nickname} 在盲盘挑战中得到 ${scoreboard.playerScore.score} 分`;
    const text =
      locale === "en"
        ? `${responses ? `${responses} ${responses === 1 ? "friend has" : "friends have"} answered. ` : ""}Same hidden chart, five decisions. Can you beat ${scoreboard.playerScore.score}?`
        : `${responses ? `已有 ${responses} 位好友完成。` : ""}同一张隐藏行情，五次决策。你能超过 ${scoreboard.playerScore.score} 分吗？`;
    try {
      const shareUrl = await platformDuelUrl(shareCode);
      if (navigator.share) {
        await navigator.share({
          title,
          text,
          url: taggedChallengeUrl(shareUrl, "native"),
        });
        recordDuelShare("native");
        setDuelRoomShareStatus(
          locale === "en" ? "Duel shared" : "擂台已分享",
        );
      } else {
        await navigator.clipboard.writeText(
          `${text}\n${taggedChallengeUrl(shareUrl, "copy")}`,
        );
        recordDuelShare("copy");
        setDuelRoomShareStatus(
          locale === "en" ? "Duel link copied" : "擂台链接已复制",
        );
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setDuelRoomShareStatus(
        locale === "en" ? "Could not share" : "分享失败",
      );
    }
  };

  const adjustQuantity = (direction: -1 | 1) => {
    const currentQuantity = Number(quantityInput) || 0;
    const nextQuantity = Math.max(
      0,
      Math.min(maxQuotedQuantity, currentQuantity + direction * lotSize),
    );
    setOrderInputMode("quantity");
    setQuantityInput(nextQuantity ? String(nextQuantity) : "");
  };

  const tradeDisabled =
    isRevealing ||
    finished ||
    dailyExpired ||
    (requiresForecast && !forecastTouched) ||
    remainingDays <= 0 ||
    estimatedQuantity <= 0 ||
    Boolean(quantityError);
  const holdDisabled =
    isRevealing ||
    finished ||
    dailyExpired ||
    remainingDays <= 0 ||
    (requiresForecast && !forecastTouched);
  const activationSource = initialCrewCode
    ? "crew"
    : initialDuel
      ? "duel"
      : "direct";
  const continueAfterFeedback = () => {
    setDecisionRevealOpen(false);
    if (playerId)
      trackActivationEvent(playerId, "decision_continue", activationSource);
    window.requestAnimationFrame(() => {
      const forecast = document.querySelector<HTMLElement>(
        ".probability-contract .outlook-grid button",
      );
      forecast?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "center",
      });
      forecast?.focus({ preventScroll: true });
    });
  };
  useEffect(() => {
    const handleKeyboard = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        finished ||
        isRevealing ||
        challengeLoading ||
        resultOpen ||
        rulesOpen ||
        analysisOpen ||
        trainingOpen ||
        quizOpen ||
        scoreboardOpen ||
        duelInviteOpen ||
        onboardingStep === 3
      )
        return;
      const recordShortcut = () => {
        if (playerId)
          trackActivationEvent(
            playerId,
            "keyboard_first_action",
            activationSource,
          );
      };
      if (event.key === "Enter" && decisionRevealOpen) {
        event.preventDefault();
        recordShortcut();
        continueAfterFeedback();
        return;
      }
      const target = event.target as HTMLElement | null;
      if (
        target?.closest(
          "input, select, textarea, a, summary, [contenteditable='true']",
        )
      )
        return;
      if (
        target?.closest("button") &&
        (event.key === "Enter" || event.key === " ")
      )
        return;
      const key = event.key.toLowerCase();
      const forecastByKey: Record<string, MarketOutlook> = {
        "1": "up",
        "2": "range",
        "3": "down",
      };
      const keyboardForecast = forecastByKey[key];
      if (keyboardForecast) {
        event.preventDefault();
        setRecordView(true);
        setOutlook(keyboardForecast);
        setForecastTouched(true);
        if (onboardingStep === 1) setOnboardingStep(2);
        recordShortcut();
        return;
      }
      if (key === "b") {
        event.preventDefault();
        setMode("buy");
        setOrderInputMode("allocation");
        setQuantityInput("");
        recordShortcut();
        return;
      }
      if (key === "s" && shares > 0.000001) {
        event.preventDefault();
        setMode("sell");
        setOrderInputMode("allocation");
        setQuantityInput("");
        recordShortcut();
        return;
      }
      if (key === "h" && !holdDisabled) {
        event.preventDefault();
        recordShortcut();
        void advance("hold");
        return;
      }
      if (event.key === "Enter" && !tradeDisabled) {
        event.preventDefault();
        recordShortcut();
        void advance("trade");
      }
    };
    window.addEventListener("keydown", handleKeyboard);
    return () => window.removeEventListener("keydown", handleKeyboard);
  });
  const celebrationCopy = celebration
    ? CELEBRATION_COPY[celebration][locale === "zh" ? "zh" : "en"]
    : null;
  return (
    <Localized locale={locale}>
    <main
      className={`shell ${guidedRunActive ? "guided-first-play" : ""}`}
      data-market={market}
      data-game-mode={gameMode}
      data-entry-mode={initialMode}
      data-onboarding-step={onboardingStep || undefined}
    >
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">K</span>
          <span>盲盘</span>
        </div>
        <Link
          className="mode-entry"
          href={initialGuide ? "/?modes=1" : "/"}
          aria-label={locale === "en" ? "Back to game modes" : "返回玩法大厅"}
        >
          <small>{locale === "en" ? "MODE" : "模式"}</small>
          <b>
            {activeDuel
              ? locale === "en"
                ? "Friend Duel"
                : "好友对决"
              : isMarketRun
                ? locale === "en"
                  ? "Market Run"
                  : "市场闯关"
              : isQuickRead
                ? locale === "en"
                  ? "Quick Read"
                  : "快速读盘"
              : isEndlessMode
                ? locale === "en"
                  ? "Endless"
                  : "无尽长周期"
              : initialMode === "training" || activeScenario
                ? locale === "en"
                  ? "Training Lab"
                  : "训练学院"
                : gameMode === "daily"
                  ? locale === "en"
                    ? "Daily"
                    : "每日挑战"
                  : locale === "en"
                    ? "Practice"
                    : "无限练习"}
          </b>
          <span>↗</span>
        </Link>
        <div className="market-switch" role="group" aria-label="选择股票市场">
          <button
            className={market === "cn" ? "active" : ""}
            disabled={challengeLoading || isRevealing || isMarketRun}
            onPointerEnter={() =>
              market !== "cn" &&
              prefetchChallenge(gameMode, "cn", session.scenario, session.difficulty)
            }
            onFocus={() =>
              market !== "cn" &&
              prefetchChallenge(gameMode, "cn", session.scenario, session.difficulty)
            }
            onClick={() => changeMarket("cn")}
          >
            A股
          </button>
          <button
            className={market === "us" ? "active" : ""}
            disabled={challengeLoading || isRevealing || isMarketRun}
            onPointerEnter={() =>
              market !== "us" &&
              prefetchChallenge(gameMode, "us", session.scenario, session.difficulty)
            }
            onFocus={() =>
              market !== "us" &&
              prefetchChallenge(gameMode, "us", session.scenario, session.difficulty)
            }
            onClick={() => changeMarket("us")}
          >
            美股
          </button>
        </div>
        <div className="round-pill">
          <span>
            {isQuickRead
              ? `${marketLabel}Quick Read · 3 calls`
              : gameMode === "daily"
              ? `${marketLabel}每日 5 决策`
              : isEndlessMode
              ? `${marketLabel}Endless · 长周期`
              : `${marketLabel}无限练习`}
          </span>
          <i />
            {isBoundedChallenge
              ? locale === "en"
                ? `Decision ${Math.min(session.decisionsUsed + 1, dailyDecisionTarget)}/${dailyDecisionTarget}`
                : `第 ${Math.min(session.decisionsUsed + 1, dailyDecisionTarget)}/${dailyDecisionTarget} 次`
            : isEndlessMode
              ? locale === "en"
                ? `${advancedDays.toLocaleString(numberLocale)} trading days advanced`
                : `已推进 ${advancedDays.toLocaleString(numberLocale)} 个交易日`
              : `已推进 ${advancedDays} 个交易日`}
        </div>
        <div className="top-actions">
          <select
            className="game-language-select"
            value={locale}
            aria-label="Language / 语言"
            onChange={(event) => changeLocale(event.target.value as Locale)}
          >
            <option value="en">EN</option>
            <option value="es">ES</option>
            <option value="fr">FR</option>
            <option value="de">DE</option>
            <option value="it">IT</option>
            <option value="zh">ZH</option>
          </select>
          <button
            className="player-chip"
            onClick={() => setScoreboardOpen(true)}
            title={initialIdentity ? "已连接站点账号，训练进度云端同步" : "当前设备训练档案"}
          >
            <i>{nickname.slice(0, 1)}</i>
            <span>{nickname}</span>
            {scoreboard?.stats?.streak ? (
              <b>🔥 {scoreboard.stats.streak}</b>
            ) : initialIdentity ? (
              <b className="identity-cloud">云端</b>
            ) : null}
          </button>
          <button className="text-button" onClick={() => setRulesOpen(true)}>
            游戏规则
          </button>
        </div>
      </header>
      {storageIsEphemeral && (
        <div className="storage-fallback-banner" role="status">
          <span>{locale === "zh" ? "临时会话" : "PRIVATE SESSION"}</span>
          <b>
            {locale === "zh"
              ? "保持此标签页打开即可继续当前进度。"
              : "Keep this tab open to continue your current progress."}
          </b>
          <small>
            {locale === "zh"
              ? "浏览器已阻止本地存储，但游戏仍可正常进行。"
              : "Browser storage is blocked, but the game remains fully playable."}
          </small>
        </div>
      )}
      {activeDuel && scoreboard?.duelRoom && (
        <div className="duel-banner">
          <span>⚔</span>
          <b>
            {scoreboard.duelRoom.isHost
              ? scoreboard.duelRoom.challengerFinished
                ? locale === "en"
                  ? `Your duel room · ${scoreboard.duelRoom.responseCount} completed`
                  : `你的好友擂台 · ${scoreboard.duelRoom.responseCount} 人已完成`
                : locale === "en"
                  ? "Private duel ready · invite while you play"
                  : "私密对决已就绪 · 边玩边邀请"
              : scoreboard.duelRoom.challengerFinished && scoreboard.opponent
                ? locale === "en"
                  ? `Beat ${scoreboard.opponent.nickname}'s ${scoreboard.opponent.score}`
                  : `挑战 ${scoreboard.opponent.nickname} 的 ${scoreboard.opponent.score} 分`
                : locale === "en"
                  ? `Race ${scoreboard.duelRoom.challengerNickname}`
                  : `与 ${scoreboard.duelRoom.challengerNickname} 同图竞速`}
          </b>
          <small>
            {scoreboard.duelRoom.isHost && !scoreboard.duelRoom.challengerFinished
              ? locale === "en"
                ? "The room is joinable now · your score stays hidden until you finish"
                : "好友现在即可加入 · 你的成绩会在完成后锁定"
              : scoreboard.duelRoom.isHost
                ? locale === "en"
                  ? scoreboard.duelRoom.bestScore == null
                    ? "Your score is live · waiting for the first reply"
                    : `Best reply ${scoreboard.duelRoom.bestScore} · ${scoreboard.duelRoom.bestNickname}`
                  : scoreboard.duelRoom.bestScore == null
                    ? "你的成绩已上线 · 等待第一位好友应战"
                    : `最佳应战 ${scoreboard.duelRoom.bestScore} 分 · ${scoreboard.duelRoom.bestNickname}`
                : locale === "en"
                  ? "Same hidden chart · play in parallel · verified score"
                  : "同一张隐藏行情 · 可同时作答 · 服务器复算"}
          </small>
          <strong>
            {scoreboard.duelRoom.isHost
              ? scoreboard.duelRoom.challengerFinished
                ? scoreboard.playerScore?.score ?? "—"
                : `${session.decisionsUsed}/${dailyDecisionTarget}`
              : `${session.decisionsUsed}/${dailyDecisionTarget}`}
          </strong>
          <button onClick={() => setDuelInviteOpen(true)}>
            {scoreboard.duelRoom.isHost
              ? scoreboard.duelRoom.challengerFinished
                ? locale === "en"
                  ? "Room"
                  : "擂台"
                : locale === "en"
                  ? "Invite"
                  : "邀请"
              : locale === "en"
                ? "Details"
                : "详情"}
          </button>
        </div>
      )}
      {dailyExpired ? (
        <div className="daily-refresh-banner" role="status">
          <span>{locale === "en" ? "NEW MARKET DAY" : "新的市场日"}</span>
          <b>
            {locale === "en"
              ? "A fresh mystery chart is ready"
              : "新的每日神秘图已经准备好"}
          </b>
          <small>
            {locale === "en"
              ? `Daily puzzles reset at ${marketResetLabel.toLowerCase()}. This unfinished chart will not be submitted.`
              : `每日题在${marketResetLabel}更新；当前未完成题不会提交。`}
          </small>
          <button
            disabled={challengeLoading}
            onClick={() => void resetGame("daily", market)}
          >
            {challengeLoading
              ? locale === "en"
                ? "Loading…"
                : "加载中…"
              : locale === "en"
                ? "Load today's chart →"
                : "载入今日新题 →"}
          </button>
        </div>
      ) : gameMode === "daily" && !activeDuel ? (
        <div className="daily-flash-banner">
          <span>
            {initialCrewCode
              ? crewResult
                ? `${crewResult.name} · CREW RUN`
                : "CREW DAILY COMMITMENT"
              : "DAILY MARKET MYSTERY"}
          </span>
          <b>
            {initialCrewCode
              ? locale === "en"
                ? "One hidden chart · your finish counts for the crew"
                : "一张隐藏行情 · 你的完成将计入小队"
              : "同一张图 · 5 次决策 · 约 90 秒"}
          </b>
          <small>
            {initialCrewCode
              ? crewResult
                ? locale === "en"
                  ? `${crewResult.completedToday}/${crewResult.memberCount} crew members checked in today`
                  : `今天已有 ${crewResult.completedToday}/${crewResult.memberCount} 位成员完成`
                : locale === "en"
                  ? "Finish five decisions to keep the shared flame alive"
                  : "完成五次决策，守住共同火焰"
              : "全球玩家同题，股票与日期将在结算后揭晓"}
          </small>
          <strong>{session.decisionsUsed}/{dailyDecisionTarget}</strong>
        </div>
      ) : isQuickRead ? (
        <div className="quick-read-banner">
          <span>{locale === "en" ? "QUICK READ" : "快速读盘"}</span>
          <b>
            {locale === "en"
              ? "Three focused calls · full reveal"
              : "三次专注判断 · 完整揭晓"}
          </b>
          <small>
            {locale === "en"
              ? "No leaderboard pressure. Build a repeatable read in under a minute."
              : "不计入排行榜，在一分钟内建立可复盘的读盘过程。"}
          </small>
          <strong>{session.decisionsUsed}/{dailyDecisionTarget}</strong>
        </div>
      ) : isEndlessMode ? (
        <div className="endless-banner">
          <span>{locale === "en" ? "ENDLESS" : "无尽长周期"}</span>
          <b>
            {locale === "en"
              ? "One long historical cycle · keep reading until the end"
              : "一段长历史周期 · 持续判断直到行情终点"}
          </b>
          <small>
            {locale === "en"
              ? "No round cap and no leaderboard. Pause, return, and build a deeper decision record."
              : "没有回合上限，也不计入排行榜；可以中途离开，回来继续建立更完整的判断记录。"}
          </small>
          <strong>{advancedDays.toLocaleString(numberLocale)}d</strong>
        </div>
      ) : null}
      {isMarketRun && (
        <div className="market-run-banner">
          <span>{locale === "en" ? "MARKET RUN" : "市场闯关"}</span>
          <b>{marketRunStage.title[copyLocale]}</b>
          <div aria-label={locale === "en" ? "Five-stage run progress" : "五关进度"}>
            {MARKET_RUN_STAGES.map((stage, index) => (
              <i
                key={stage.key}
                className={
                  index < marketRunCompletedStages
                    ? "complete"
                    : index === marketRunStageIndex
                      ? "current"
                      : ""
                }
              >
                {index < marketRunProgress.scores.length
                  ? marketRunProgress.scores[index]
                  : index + 1}
              </i>
            ))}
          </div>
          <strong>
            {locale === "en" ? "RUN TOTAL" : "闯关总分"} · {marketRunScore}
          </strong>
        </div>
      )}
      {activeScenario && !isMarketRun && (
        <div className="mission-banner">
          <span>训练任务</span>
          <b>
            {activeScenario.title} · {activeDifficulty.label}
          </b>
          <p>{activeScenario.mission}</p>
          <small>{scenarioEvaluation?.completed || 0}/4 项当前达标</small>
          <button onClick={() => setTrainingOpen(true)}>更换训练</button>
        </div>
      )}
      {onboardingStep > 0 && !finished && (
        <aside
          className={`first-run-coach first-run-step-${onboardingStep}`}
          aria-live="polite"
        >
          <div className="first-run-progress" aria-hidden="true">
            {[1, 2, 3].map((step) => (
              <i
                key={step}
                className={step <= onboardingStep ? "complete" : ""}
              />
            ))}
          </div>
          <div>
            <small>
              {locale === "en"
                ? `${initialDuel ? "GUIDED DUEL" : "BEGINNER CHART · REAL HISTORY"} · STEP ${onboardingStep}/3`
                : `${initialDuel ? "好友对决引导" : "首次引导局"} · 第 ${onboardingStep}/3 步`}
            </small>
            <b>
              {onboardingStep === 1
                ? locale === "en"
                  ? "Read the chart, then make one forecast"
                  : "先读图，再做一次判断"
                : onboardingStep === 2
                  ? locale === "en"
                    ? "Choose an action and reveal three real days"
                    : "选择行动，揭示接下来三个真实交易日"
                  : initialDuel
                    ? locale === "en"
                      ? "You know the loop—four decisions left"
                      : "你已掌握循环，还剩四次决策"
                    : locale === "en"
                      ? "That is the whole loop"
                      : "核心循环已经完成"}
            </b>
            <p>
              {onboardingStep === 1
                ? locale === "en"
                  ? "The ticker and date are hidden. Look for trend, momentum, and volatility—then tap Up, Range, or Down below."
                  : "股票与日期已隐藏。观察趋势、动量和波动，然后在下方选择看涨、震荡或看跌。"
                : onboardingStep === 2
                  ? locale === "en"
                    ? "Buy, sell, or stay in cash. Your forecast is scored separately from profit, so a lucky trade cannot fake a good read."
                    : "买入、卖出或保持空仓。判断与收益分开评分，一次幸运交易不能冒充好判断。"
                  : initialDuel
                    ? locale === "en"
                      ? `Keep reading the same hidden chart. Your final score will be compared with ${scoreboard?.opponent?.nickname ?? "your friend"}.`
                      : `继续判断同一张隐藏行情。完成后，你的总分将与${scoreboard?.opponent?.nickname ?? "好友"}直接比较。`
                    : locale === "en"
                      ? "The new candles are real history. One result is evidence, not a strategy—keep testing your read across different charts."
                      : "新出现的 K 线来自真实历史。一次结果只是证据，不是策略；继续跨行情验证你的判断。"}
            </p>
            {onboardingStep === 3 && lastFeedback && (
              <div
                className={`first-run-verdict ${lastFeedback.matched ? "matched" : "surprised"}`}
              >
                <span>
                  {lastFeedback.matched
                    ? locale === "en"
                      ? "READ CONFIRMED"
                      : "判断命中"
                    : locale === "en"
                      ? "NEW EVIDENCE"
                      : "出现新证据"}
                </span>
                <b>
                  {locale === "en"
                    ? `${OUTLOOK_LABEL_EN[lastFeedback.forecast]} → ${OUTLOOK_LABEL_EN[lastFeedback.actual]}`
                    : `${OUTLOOK_LABEL[lastFeedback.forecast]} → ${OUTLOOK_LABEL[lastFeedback.actual]}`}
                </b>
              </div>
            )}
          </div>
          {onboardingStep === 3 ? (
            initialDuel ? (
              <div className="first-run-coach-actions">
                <button
                  className="coach-primary"
                  onClick={() => completeOnboarding(true)}
                >
                  {locale === "en" ? "Continue the duel →" : "继续完成对决 →"}
                </button>
              </div>
            ) : (
              <div className="first-run-coach-actions">
                <button
                  className="coach-primary"
                  disabled={challengeLoading}
                  onClick={() => void enterDailyAfterGuide()}
                >
                  {challengeLoading
                    ? locale === "en"
                      ? "Loading today's chart…"
                      : "正在加载今日题目…"
                    : locale === "en"
                      ? "Play today's global challenge →"
                      : "进入今日全球挑战 →"}
                </button>
                <button
                  className="coach-secondary"
                  onClick={() => completeOnboarding(true)}
                >
                  {locale === "en" ? "Keep practicing" : "继续自由练习"}
                </button>
              </div>
            )
          ) : (
            <button
              className="coach-secondary"
              onClick={() => completeOnboarding(false)}
            >
              {locale === "en" ? "Skip guide" : "跳过引导"}
            </button>
          )}
        </aside>
      )}
      <section className="portfolio-strip">
        <div>
          <small>总资产</small>
          <strong>
            {currencySymbol}
            {nf.format(equity)}
          </strong>
        </div>
        <div>
          <small>持仓市值</small>
          <strong>
            {currencySymbol}
            {nf.format(positionValue)}
          </strong>
        </div>
        <div>
          <small>可用现金</small>
          <strong>
            {currencySymbol}
            {nf.format(cash)}
          </strong>
        </div>
        <div>
          <small>累计收益</small>
          <strong
            className={
              returnRate > 0 ? "up" : returnRate < 0 ? "down" : "muted"
            }
          >
            {returnRate > 0 ? "+" : ""}
            {returnRate.toFixed(2)}%
          </strong>
        </div>
        <div className="challenge">
          <span>
            {isQuickRead
              ? `${marketLabel}Quick Read · ${today}`
              : gameMode === "daily"
              ? historicalDuel
                ? scoreboard?.playerScore
                  ? locale === "en"
                    ? `Archived duel · Room #${scoreboard.playerScore.rank}`
                    : `历史好友对决 · 房间第 ${scoreboard.playerScore.rank} 名`
                  : locale === "en"
                    ? `Archived friend duel · ${today}`
                    : `历史好友对决 · ${today}`
                : scoreboard?.playerScore
                  ? `${marketLabel}已上榜 · 第 ${scoreboard.playerScore.rank} 名`
                  : `${marketLabel}每日同题 · #${today.slice(5).replace("-", "")}`
              : `${marketLabel}${scenarioLabel}`}
          </span>
          <small>
            {activeDuel
              ? scoreboard?.duelRoom?.isHost
                ? locale === "en"
                  ? `${scoreboard.duelRoom.responseCount} friends completed your duel room`
                  : `好友擂台已有 ${scoreboard.duelRoom.responseCount} 人完成`
                : locale === "en"
                  ? "Friend duel in progress · compare after settlement"
                  : "好友挑战进行中，结算后对比"
              : "价格已归一化，身份结算后揭晓"}
          </small>
        </div>
      </section>
      <section className="workspace">
        <div className="chart-panel">
          {revealPulse > 0 && (
            <span key={revealPulse} className="reveal-toast">
              +{actions.at(-1)?.days || revealDays} 个交易日
            </span>
          )}
          {lastFeedback && decisionRevealOpen && !finished && (
            <aside
              key={lastFeedback.round}
              className={`decision-reveal-card ${lastFeedback.matched ? "hit" : "miss"}`}
              role="status"
              aria-live="polite"
            >
              <header>
                <span>
                  {lastFeedback.matched
                    ? locale === "en"
                      ? "CALL HIT"
                      : "判断命中"
                    : locale === "en"
                      ? "CALL MISSED"
                      : "判断偏差"}
                </span>
                <button
                  type="button"
                  onClick={() => setDecisionRevealOpen(false)}
                  aria-label={locale === "en" ? "Dismiss result" : "关闭本次结果"}
                >
                  ×
                </button>
              </header>
              <div>
                <div className="decision-reveal-score">
                  <strong>{Math.round(lastFeedback.calibration)}</strong>
                  <small>{locale === "en" ? "CALIBRATION" : "校准分"}</small>
                </div>
                <div className="decision-reveal-copy">
                  <small>
                    {locale === "en"
                      ? `DECISION ${lastFeedback.round}${requiresForecast ? ` / ${isMarketRun ? MARKET_RUN_DECISIONS : dailyDecisionTarget}` : ""}`
                      : `第 ${lastFeedback.round}${requiresForecast ? ` / ${isMarketRun ? MARKET_RUN_DECISIONS : dailyDecisionTarget}` : ""} 次决策`}
                  </small>
                  <b>
                    {lastFeedback.matched
                      ? locale === "en"
                        ? "Reality matched your read"
                        : "真实走势与你的判断一致"
                      : locale === "en"
                        ? "Reality broke your call"
                        : "真实走势打破了原判断"}
                  </b>
                  <p>
                    <span>
                      {locale === "en" ? "YOU" : "你的判断"} {locale === "en"
                        ? OUTLOOK_LABEL_EN[lastFeedback.forecast]
                        : OUTLOOK_LABEL[lastFeedback.forecast]}
                    </span>
                    <i>→</i>
                    <span>
                      {locale === "en" ? "REAL" : "实际"} {locale === "en"
                        ? OUTLOOK_LABEL_EN[lastFeedback.actual]
                        : OUTLOOK_LABEL[lastFeedback.actual]} {lastFeedback.move >= 0 ? "+" : ""}{lastFeedback.move.toFixed(2)}%
                    </span>
                  </p>
                </div>
              </div>
              <footer>
                <span>
                  {evidenceStreak >= 2
                    ? locale === "en"
                      ? `EVIDENCE STREAK ×${evidenceStreak}`
                      : `连续命中 ×${evidenceStreak}`
                    : lastFeedback.matched
                      ? locale === "en"
                        ? "ONE RESULT IS EVIDENCE"
                        : "一次结果只是证据"
                      : locale === "en"
                        ? "RESET · NEXT CALL IS NEW"
                        : "重新判断 · 下一次独立开始"}
                </span>
                {latestCrowdLeader && crowdForecast && crowdForecast.sampleSize >= 2 && (
                  <span>
                    {locale === "en" ? "CROWD" : "人群"} {locale === "en"
                      ? OUTLOOK_LABEL_EN[latestCrowdLeader]
                      : OUTLOOK_LABEL[latestCrowdLeader]} {crowdForecast[latestCrowdLeader]}%
                  </span>
                )}
                {onboardingStep !== 3 && (
                  <button
                    type="button"
                    onClick={continueAfterFeedback}
                    aria-keyshortcuts="Enter"
                  >
                    {locale === "en" ? "Next call →" : "下一次判断 →"}
                  </button>
                )}
              </footer>
            </aside>
          )}
          <div className="chart-head">
            <div>
              <span className="ticker-mask">••••••</span>
              <span className="market-tag">{marketLabel}</span>
              <span className="market-tag">日 K</span>
              <span className="adjust-tag">服务器逐段揭示</span>
            </div>
            <div className="ohlc">
              <span>
                开 <b>{current.open.toFixed(2)}</b>
              </span>
              <span>
                高 <b>{current.high.toFixed(2)}</b>
              </span>
              <span>
                低 <b>{current.low.toFixed(2)}</b>
              </span>
              <span>
                收 <b>{current.close.toFixed(2)}</b>
              </span>
              <strong className={dayChange >= 0 ? "up" : "down"}>
                {dayChange >= 0 ? "+" : ""}
                {dayChange.toFixed(2)}%
              </strong>
            </div>
          </div>
          <div className="ma-row">
            <span>MA5 {ma5?.toFixed(2)}</span>
            <span>MA10 {ma10?.toFixed(2)}</span>
            <span>MA20 {ma20?.toFixed(2)}</span>
            <span
              className="market-color-key"
              aria-label={
                locale === "en"
                  ? `${market === "us" ? "US" : "China A-share"} market colors: up and buy are ${market === "us" ? "green" : "red"}; down and sell are ${market === "us" ? "red" : "green"}`
                  : `${market === "us" ? "美股" : "A股"}配色：上涨与买入为${market === "us" ? "绿色" : "红色"}，下跌与卖出为${market === "us" ? "红色" : "绿色"}`
              }
            >
              <i className="market-up-swatch" aria-hidden="true" />
              {locale === "en" ? "UP" : "涨"}
              <i className="market-down-swatch" aria-hidden="true" />
              {locale === "en" ? "DOWN" : "跌"}
            </span>
            <em>
              相对量{" "}
              {current.volume
                ? (
                    current.volume /
                    (data
                      .slice(-20)
                      .reduce((sum, candle) => sum + candle.volume, 0) /
                      Math.min(20, data.length))
                  ).toFixed(2)
                : "0"}
              ×
            </em>
          </div>
          <CandleChart
            key={session.sessionId}
            data={data}
            markers={tradeMarkers}
            market={market}
            locale={locale}
          />
        </div>
        <aside className="trade-panel">
          <div className="decision-head">
            <span>股票交易</span>
            <div className="decision-head-meta">
              <small>
                {isQuickRead
                  ? locale === "en"
                    ? `Quick Read · ${dailyDecisionsRemaining} calls left`
                    : `快速读盘 · 剩余 ${dailyDecisionsRemaining} 次判断`
                  : isEndlessMode
                  ? locale === "en"
                    ? `Endless · ${advancedDays.toLocaleString(numberLocale)} trading days`
                    : `无尽长周期 · 已推进 ${advancedDays.toLocaleString(numberLocale)} 个交易日`
                  : gameMode === "daily"
                  ? locale === "en"
                    ? `Daily sprint · ${dailyDecisionsRemaining} decisions left`
                    : `每日快局 · 剩余 ${dailyDecisionsRemaining} 次决策`
                  : locale === "en"
                  ? "Practice · stop anytime"
                  : "无限练习 · 随时结束"}
              </small>
              <span className="keyboard-shortcuts" aria-label="Keyboard shortcuts">
                <span><kbd>1–3</kbd>{locale === "en" ? " forecast" : " 判断"}</span>
                <span><kbd>B/S</kbd>{locale === "en" ? " trade" : " 买卖"}</span>
                <span><kbd>H</kbd>{locale === "en" ? " hold" : " 观望"}</span>
                <span><kbd>↵</kbd>{locale === "en" ? " act" : " 执行"}</span>
              </span>
            </div>
          </div>
          <div
            className={`horizon-track ${isBoundedChallenge || isMarketRun ? "daily-limited" : "open-ended"}`}
          >
            <i
              style={
                isBoundedChallenge
                  ? {
                      width: `${Math.min(100, (session.decisionsUsed / dailyDecisionTarget) * 100)}%`,
                    }
                  : isMarketRun
                    ? {
                        width: `${Math.min(100, (session.decisionsUsed / MARKET_RUN_DECISIONS) * 100)}%`,
                      }
                  : undefined
              }
            />
            <span>
              {isQuickRead ? (
                <>
                  {locale === "en"
                    ? <>Quick Read · Decision {Math.min(session.decisionsUsed + 1, dailyDecisionTarget)}/{dailyDecisionTarget}</>
                    : <>快速读盘 · 第 {Math.min(session.decisionsUsed + 1, dailyDecisionTarget)}/{dailyDecisionTarget} 次判断</>}
                </>
              ) : gameMode === "daily" ? (
                <>
                  {locale === "en" ? (
                    <>Daily challenge #{today.replaceAll("-", "")} · Decision{" "}
                      {Math.min(session.decisionsUsed + 1, dailyDecisionTarget)}/{dailyDecisionTarget}</>
                  ) : (
                    <>今日挑战 #{today.replaceAll("-", "")} · 第{" "}
                      {Math.min(session.decisionsUsed + 1, dailyDecisionTarget)}/{dailyDecisionTarget} 次判断</>
                  )}
                </>
              ) : isMarketRun ? (
                <>
                  {locale === "en"
                    ? `Market ${marketRunStageIndex + 1}/${MARKET_RUN_STAGES.length} · ${marketRunStage.title.en} · Decision ${Math.min(session.decisionsUsed + 1, MARKET_RUN_DECISIONS)}/${MARKET_RUN_DECISIONS}`
                    : `第 ${marketRunStageIndex + 1}/${MARKET_RUN_STAGES.length} 关 · ${marketRunStage.title.zh} · 判断 ${Math.min(session.decisionsUsed + 1, MARKET_RUN_DECISIONS)}/${MARKET_RUN_DECISIONS}`}
                </>
              ) : (
                <>
                  {session.resumed ? "已恢复云端进度 · " : ""}
                  已推进 {advancedDays} 个交易日 · 尚有{" "}
                  {remainingDays.toLocaleString(numberLocale)} 个交易日 · 可随时结束
                </>
              )}
            </span>
          </div>
          <div className="price-block">
            <small>归一化价格</small>
            <strong>{current.close.toFixed(2)}</strong>
            <span className={dayChange >= 0 ? "up" : "down"}>
              {dayChange >= 0 ? "+" : ""}
              {dayChange.toFixed(2)}%
            </span>
          </div>
          {shares > 0.000001 ? (
            <div className="position-card">
              <div>
                <small>持仓数量</small>
                <b>{shareNf.format(shares)} 股</b>
              </div>
              <div>
                <small>当前市值</small>
                <b>
                  {currencySymbol}
                  {nf.format(positionValue)}
                </b>
              </div>
              <div className="position-bar">
                <i
                  style={{
                    width: `${Math.min(100, (positionValue / equity) * 100)}%`,
                  }}
                />
              </div>
              <span>仓位 {((positionValue / equity) * 100).toFixed(1)}%</span>
            </div>
          ) : (
            <div className="position-empty">
              <span className="empty-ring" />
              <b>当前空仓</b>
              <small>不操作也是一种有效决策</small>
            </div>
          )}
          {lastFeedback && !finished && (
            <details className="decision-feedback">
              <summary>
                <span className={lastFeedback.matched ? "hit" : "miss"}>
                  {lastFeedback.matched ? "✓" : "!"}
                </span>
                <div>
                  <small>上次记录观点 · 第 {lastFeedback.round} 次推进</small>
                  <b>{lastFeedback.title}</b>
                </div>
                <i>展开</i>
              </summary>
              <p>{lastFeedback.lesson}</p>
              <div>
                <span>
                  最大有利 <b>+{lastFeedback.favorable.toFixed(1)}%</b>
                </span>
                <span>
                  最大不利 <b>{lastFeedback.adverse.toFixed(1)}%</b>
                </span>
              </div>
            </details>
          )}
          {crowdForecast && !finished && gameMode === "daily" && (
            <section
              className="crowd-consensus"
              aria-label={
                locale === "en"
                  ? `Global crowd forecast from ${crowdForecast.sampleSize} locked players`
                  : `${crowdForecast.sampleSize} 位已锁定玩家的全球共识`
              }
            >
              <header>
                <span>{locale === "en" ? "GLOBAL CROWD" : "全球共识"}</span>
                <b>
                  {crowdForecast.sampleSize.toLocaleString(numberLocale)}
                  {locale === "en" ? " locked" : " 位已锁定"}
                </b>
              </header>
              <div className="crowd-bar" aria-hidden="true">
                <i
                  className="crowd-up"
                  style={{ width: `${crowdForecast.up}%` }}
                />
                <i
                  className="crowd-range"
                  style={{ width: `${crowdForecast.range}%` }}
                />
                <i
                  className="crowd-down"
                  style={{ width: `${crowdForecast.down}%` }}
                />
              </div>
              <div className="crowd-labels">
                <span>
                  {locale === "en" ? "UP" : "涨"} <b>{crowdForecast.up}%</b>
                </span>
                <span>
                  {locale === "en" ? "RANGE" : "震"}{" "}
                  <b>{crowdForecast.range}%</b>
                </span>
                <span>
                  {locale === "en" ? "DOWN" : "跌"}{" "}
                  <b>{crowdForecast.down}%</b>
                </span>
              </div>
              <small>
                {locale === "en"
                  ? "Revealed only after your forecast locks · no future price shown"
                  : "仅在你的判断锁定后显示 · 不泄露未来走势"}
              </small>
            </section>
          )}
          {!finished ? (
            <>
              <div className="mode-tabs">
                <button
                  className={mode === "buy" ? "active buy" : ""}
                  aria-keyshortcuts="B"
                  onClick={() => {
                    setMode("buy");
                    setOrderInputMode("allocation");
                    setQuantityInput("");
                  }}
                >
                  买入
                </button>
                <button
                  className={mode === "sell" ? "active sell" : ""}
                  aria-keyshortcuts="S"
                  onClick={() => {
                    setMode("sell");
                    setOrderInputMode("allocation");
                    setQuantityInput("");
                  }}
                  disabled={!shares}
                >
                  卖出
                </button>
              </div>
              {!isBoundedChallenge && (
                <div className="order-type-row">
                  <span>市价委托</span>
                  <small>下一交易日开盘成交</small>
                </div>
              )}
              <label className="field-label">
                {isBoundedChallenge
                  ? locale === "en"
                    ? "1 · Choose action & size"
                    : "1 · 选择行动与仓位"
                  : mode === "buy"
                    ? "使用可用现金"
                    : "卖出当前持仓"}
              </label>
              <div
                className="allocation-grid"
                role="group"
                aria-label="选择委托仓位"
              >
                {(isBoundedChallenge
                  ? DAILY_ORDER_ALLOCATIONS
                  : ORDER_ALLOCATIONS
                ).map((value) => (
                  <button
                    key={value}
                    className={
                      orderInputMode === "allocation" && allocation === value
                        ? "selected"
                        : ""
                    }
                    onClick={() => {
                      setAllocation(value);
                      setOrderInputMode("allocation");
                      setQuantityInput("");
                    }}
                  >
                    {value === 1
                      ? "全仓"
                      : value === 1 / 3
                        ? "1/3"
                        : value === 0.25
                          ? "1/4"
                          : value === 0.5
                            ? "1/2"
                            : "3/4"}
                  </button>
                ))}
              </div>
              {!isBoundedChallenge && (
                <>
                  <label
                    className="field-label quantity-label"
                    htmlFor="order-quantity"
                  >
                    <span>或按股数委托</span>
                    <small>
                      {market === "cn"
                        ? "A股 100 股起，按整手交易"
                        : "美股按整数股交易"}
                    </small>
                  </label>
                  <div
                    className={`quantity-field ${orderInputMode === "quantity" ? "active" : ""} ${quantityError ? "invalid" : ""}`}
                  >
                    <button
                      type="button"
                      className="quantity-step"
                      aria-label={`减少 ${lotSize} 股`}
                      disabled={
                        isRevealing ||
                        !quantityInput ||
                        Number(quantityInput) <= 0
                      }
                      onClick={() => adjustQuantity(-1)}
                    >
                      −
                    </button>
                    <input
                      id="order-quantity"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder={
                        market === "cn" ? "输入股数，如 500" : "输入股数，如 25"
                      }
                      value={quantityInput}
                      onFocus={() => setOrderInputMode("quantity")}
                      onChange={(event) => {
                        setOrderInputMode("quantity");
                        setQuantityInput(
                          event.target.value.replace(/\D/g, "").slice(0, 7),
                        );
                      }}
                    />
                    <button
                      type="button"
                      className="quantity-step"
                      aria-label={`增加 ${lotSize} 股`}
                      disabled={
                        isRevealing ||
                        maxQuotedQuantity <= 0 ||
                        Number(quantityInput || 0) >= maxQuotedQuantity
                      }
                      onClick={() => adjustQuantity(1)}
                    >
                      ＋
                    </button>
                    <span>股</span>
                  </div>
                </>
              )}
              {quantityError ? (
                <p className="order-error">{quantityError}</p>
              ) : (
                <div className="order-estimate">
                  <span>
                    {isBoundedChallenge
                      ? locale === "en"
                        ? "Position"
                        : "预计仓位"
                      : "预计委托"}{" "}
                    <b>{shareNf.format(estimatedQuantity)} 股</b>
                  </span>
                  <div>
                    <strong>
                      {mode === "buy" ? "预计占用" : "预计到账"}{" "}
                      {currencySymbol}
                      {nf.format(Math.abs(estimatedQuote.cashDelta))}
                    </strong>
                    <small>
                      {isBoundedChallenge ? (
                        locale === "en" ? (
                          "Market costs included automatically"
                        ) : (
                          "已自动计入滑点与交易费用"
                        )
                      ) : (
                        <>
                          {currencySymbol}
                          {nf.format(estimatedQuote.referenceGross)} {" "}
                          {mode === "buy" ? "+" : "−"} 滑点 {currencySymbol}
                          {nf.format(estimatedQuote.slippageCost)} {" "}
                          {mode === "buy" ? "+" : "−"} 费用 {currencySymbol}
                          {nf.format(estimatedQuote.totalFees)}
                        </>
                      )}
                    </small>
                  </div>
                </div>
              )}
              {!isBoundedChallenge && (
                <details className="fee-preview">
                  <summary>真实成本模型 · 2026-04 监管口径</summary>
                  <div>
                    {market === "cn" ? (
                      <>
                        <span>模拟佣金 0.025%，最低 ¥5</span>
                        <span>过户费 0.001%，买卖双向</span>
                        <span>印花税 0.05%，仅卖出</span>
                        <span>模拟滑点 0.02%</span>
                      </>
                    ) : (
                      <>
                        <span>模拟券商佣金 $0</span>
                        <span>卖出监管费 $20.60 / 百万美元</span>
                        <span>卖出 TAF $0.000195 / 股，上限 $9.79</span>
                        <span>模拟滑点 0.015%</span>
                      </>
                    )}
                  </div>
                </details>
              )}
              <div
                className={`decision-journal probability-contract ${recordView || requiresForecast ? "active" : ""} ${requiresForecast ? "daily-quick-contract" : ""} ${onboardingStep === 1 ? "coach-focus" : ""}`}
              >
                <div className="optional-view-head">
                  <div>
                    <span>
                      {requiresForecast
                        ? locale === "en"
                          ? "2 · Forecast the next move"
                          : "2 · 判断接下来走势"
                        : "决策契约"}{" "}
                      <em>推进前锁定</em>
                    </span>
                    <small>
                      {requiresForecast && !forecastTouched
                        ? locale === "en"
                          ? "Required before every reveal"
                          : "每次揭示前必须重新判断"
                        : `${formatProbabilityForecast(
                            probabilityForecast(outlook, confidence),
                            locale,
                          )} · ${THESIS_LABEL[thesis]}`}
                    </small>
                  </div>
                  {!requiresForecast && (
                    <button
                      type="button"
                      aria-expanded={recordView}
                      onClick={() => setRecordView((value) => !value)}
                    >
                      {recordView ? "收起" : "编辑契约"}
                    </button>
                  )}
                </div>
                {(recordView || isBoundedChallenge) && (
                  <div className="optional-view-fields">
                    <div
                      className="outlook-grid"
                      role="group"
                      aria-label="记录本次后续走势观点"
                    >
                      {(["up", "range", "down"] as const).map((value) => (
                        <button
                          key={value}
                          aria-keyshortcuts={
                            value === "up" ? "1" : value === "range" ? "2" : "3"
                          }
                          className={
                            outlook === value &&
                            (!requiresForecast || forecastTouched)
                              ? "selected"
                              : ""
                          }
                          onClick={() => {
                            setOutlook(value);
                            setForecastTouched(true);
                            if (onboardingStep === 1) setOnboardingStep(2);
                          }}
                        >
                          <span>
                            {value === "up"
                              ? "看涨"
                              : value === "range"
                                ? "震荡"
                                : "看跌"}
                          </span>
                          <small>
                            {probabilityForecast(value, confidence)[value]}%
                          </small>
                        </button>
                      ))}
                    </div>
                    <div
                      className={
                        isBoundedChallenge
                          ? "daily-confidence-row"
                          : "journal-row"
                      }
                    >
                      {!isBoundedChallenge && (
                        <label>
                          依据
                          <select
                            value={thesis}
                            onChange={(event) =>
                              setThesis(event.target.value as DecisionThesis)
                            }
                          >
                            <option value="trend">趋势延续</option>
                            <option value="breakout">突破确认</option>
                            <option value="reversal">反转预期</option>
                            <option value="volume">量价信号</option>
                            <option value="uncertain">没有把握</option>
                          </select>
                        </label>
                      )}
                      <div>
                        <span>
                          {isBoundedChallenge
                            ? locale === "en"
                              ? "Confidence"
                              : "判断信心"
                            : "主判断概率"}
                        </span>
                        <div className="confidence-grid">
                          {([1, 2, 3] as const).map((value) => (
                            <button
                              key={value}
                              className={confidence === value ? "selected" : ""}
                              onClick={() => setConfidence(value)}
                            >
                              {value === 1 ? "50%" : value === 2 ? "65%" : "80%"}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <p>
                      {isBoundedChallenge
                        ? locale === "en"
                          ? "Your forecast locks before the real next three trading days are revealed."
                          : "判断锁定后，才会揭示真实的后续三个交易日。"
                        : "概率越激进，判断错误时校准损失越大；买入、卖出和观望都会留下同样的决策证据。"}
                    </p>
                  </div>
                )}
              </div>
              {isBoundedChallenge ? (
                <div className="daily-reveal-rule">
                  <span>
                    {locale === "en" ? "3 · ACT & REVEAL" : "3 · 行动并揭示"}
                  </span>
                  <b>
                    {locale === "en"
                      ? "Next 3 trading days"
                      : "固定推进 3 个交易日"}
                  </b>
                </div>
              ) : (
                <>
                  <div className="field-label holding-label">成交后推进多久</div>
                  <div
                    className="duration-grid"
                    role="group"
                    aria-label="选择持有交易日数"
                  >
                    {([1, 3, 5] as const).map((value) => (
                      <button
                        key={value}
                        className={revealDays === value ? "selected" : ""}
                        onClick={() => setRevealDays(value)}
                        disabled={value > remainingDays}
                      >
                        {value} 天
                      </button>
                    ))}
                  </div>
                </>
              )}
              <button
                className={`primary-action ${mode} ${onboardingStep === 2 ? "coach-focus" : ""}`}
                disabled={tradeDisabled}
                aria-keyshortcuts="Enter"
                onClick={() => advance("trade")}
              >
                {isRevealing
                  ? "行情逐日推进中…"
                  : requiresForecast && !forecastTouched
                    ? locale === "en"
                      ? "Choose your forecast first"
                      : "请先判断接下来走势"
                  : `市价${mode === "buy" ? "买入" : "卖出"} ${shareNf.format(estimatedQuantity)} 股 · 推进 ${Math.min(revealDays, remainingDays)} 天`}{" "}
                {!isRevealing && <span>→</span>}
              </button>
              <button
                className={`hold-action ${onboardingStep === 2 ? "coach-focus" : ""}`}
                disabled={holdDisabled}
                aria-keyshortcuts="H"
                onClick={() => advance("hold")}
              >
                {isRevealing
                  ? "逐根加载真实行情"
                  : requiresForecast && !forecastTouched
                    ? locale === "en"
                      ? "Forecast required before hold"
                      : "判断后才可观望"
                  : `${shares ? "保持仓位" : "保持空仓"} ${Math.min(revealDays, remainingDays)} 天`}
              </button>
              {isMarketRun ? (
                <div className="market-run-stage-rule">
                  <span>
                    {locale === "en"
                      ? `Stage ${marketRunStageIndex + 1} of ${MARKET_RUN_STAGES.length}`
                      : `第 ${marketRunStageIndex + 1}/${MARKET_RUN_STAGES.length} 关`}
                  </span>
                  <b>
                    {locale === "en"
                      ? `${MARKET_RUN_DECISIONS - Math.min(session.decisionsUsed, MARKET_RUN_DECISIONS)} calls left`
                      : `还剩 ${MARKET_RUN_DECISIONS - Math.min(session.decisionsUsed, MARKET_RUN_DECISIONS)} 次判断`}
                  </b>
                </div>
              ) : isBoundedChallenge ? (
                <Link
                  className="next-chart-action"
                  href={`/run?market=${market}`}
                >
                  {locale === "en"
                    ? "Want a longer session? Start a Market Run →"
                    : "想继续挑战？开始市场闯关 →"}
                </Link>
              ) : (
                <button
                  className="next-chart-action"
                  disabled={challengeLoading || isRevealing}
                  onPointerEnter={() =>
                    prefetchChallenge(
                      "practice",
                      market,
                      session.scenario,
                      session.difficulty,
                    )
                  }
                  onFocus={() =>
                    prefetchChallenge(
                      "practice",
                      market,
                      session.scenario,
                      session.difficulty,
                    )
                  }
                  onClick={() => void switchStock()}
                >
                  {challengeLoading
                    ? locale === "en"
                      ? "Loading another chart…"
                      : "正在切换股票…"
                    : locale === "en"
                      ? "Another random chart →"
                      : "换一只股票 →"}
                </button>
              )}
              {!isBoundedChallenge && !isMarketRun && (
                <button
                  className="finish-action"
                  onClick={() => void finishGame()}
                >
                  提前结束并揭晓股票
                </button>
              )}
              <p className="hint">
                {isMarketRun
                  ? locale === "en"
                    ? "Five decisions finish this market automatically; your score carries into the next stage."
                    : "完成五次判断后自动结算，本关得分会带入下一关。"
                  : isBoundedChallenge
                  ? isQuickRead
                    ? locale === "en"
                      ? "Three calls reveal the chart; no leaderboard, just process feedback."
                      : "三次判断后自动揭晓；不计入排行榜，只保留过程反馈"
                    : "全球玩家同一张神秘图；完成 5 次决策后自动揭晓和排名"
                  : isEndlessMode
                  ? locale === "en"
                    ? "No round cap; keep recording views until the historical period ends, or finish anytime."
                    : "没有回合上限；持续记录判断直到历史终点，也可以随时结束。"
                  : "不支持限价、做空或融资；可一直决策到该段真实历史结束"}
              </p>
            </>
          ) : (
            <div className="finished-panel">
              <small>本局已结束</small>
              <b>{profile.title}</b>
              <button
                className="primary-action"
                onClick={() => setResultOpen(true)}
              >
                查看完整结算
              </button>
            </div>
          )}
        </aside>
      </section>
      <footer className="source-note">
        <span>
          {locale === "en" ? (
            <>
              China A-shares {MARKET_UNIVERSE_SIZE.cn.toLocaleString(numberLocale)} stocks · U.S. stocks {MARKET_UNIVERSE_SIZE.us} · Real daily data loaded on demand · Not investment advice
            </>
          ) : (
            <>
              A股 {MARKET_UNIVERSE_SIZE.cn.toLocaleString(numberLocale)}{" "}
              只全市场股票池 · 美股 {MARKET_UNIVERSE_SIZE.us} 只 ·
              每局按需加载真实日线 · 不构成投资建议
            </>
          )}
        </span>
        <nav aria-label="Legal">
          <a href="/privacy" target="_blank" rel="noreferrer">隐私政策</a>
          <a href="/terms" target="_blank" rel="noreferrer">服务条款</a>
        </nav>
      </footer>

      {activeDuel &&
        duelInviteOpen &&
        scoreboard &&
        scoreboard.duelRoom &&
        !actions.length &&
        !finished && (
          <dialog open className="modal-backdrop duel-invite-backdrop">
            <section
              className="duel-invite-card"
              aria-labelledby="duel-invite-title"
            >
              {scoreboard.duelRoom?.isHost && scoreboard.playerScore ? (
                <>
                  <header>
                    <small>{locale === "en" ? "YOUR DUEL ROOM" : "你的好友擂台"}</small>
                    <span>
                      {locale === "en"
                        ? `${scoreboard.duelRoom.responseCount} COMPLETED`
                        : `${scoreboard.duelRoom.responseCount} 人已完成`}
                    </span>
                  </header>
                  <div className="duel-challenger">
                    <i>⚔</i>
                    <div>
                      <h2 id="duel-invite-title">
                        {locale === "en"
                          ? `Your ${scoreboard.playerScore.score} is still live`
                          : `你的 ${scoreboard.playerScore.score} 分仍在接受挑战`}
                      </h2>
                      <p>
                        {locale === "en"
                          ? "Everyone sees the exact same hidden chart. Share the room again as more friends answer."
                          : "所有人看到完全相同的隐藏行情；可以继续转发，等待更多好友应战。"}
                      </p>
                    </div>
                  </div>
                  <div className="duel-target-score duel-room-score">
                    <small>{locale === "en" ? "BEST RESPONSE" : "最佳应战成绩"}</small>
                    <strong>{scoreboard.duelRoom.bestScore ?? "—"}</strong>
                    <span>
                      {scoreboard.duelRoom.bestNickname
                        ? locale === "en"
                          ? `${scoreboard.duelRoom.bestNickname} leads the replies`
                          : `${scoreboard.duelRoom.bestNickname} 暂居应战榜首`
                        : locale === "en"
                          ? "Waiting for the first friend"
                          : "等待第一位好友完成"}
                    </span>
                  </div>
                  <div className="duel-room-stats">
                    <article>
                      <small>{locale === "en" ? "YOUR SCORE" : "你的成绩"}</small>
                      <b>{scoreboard.playerScore.score}</b>
                    </article>
                    <article>
                      <small>{locale === "en" ? "ROOM CODE" : "擂台码"}</small>
                      <b>{duelCode}</b>
                    </article>
                    <article>
                      <small>{locale === "en" ? "SHARES SENT" : "分享动作"}</small>
                      <b>{scoreboard.duelRoom.shareCount}</b>
                    </article>
                    <article>
                      <small>{locale === "en" ? "TOP SOURCE" : "主要来源"}</small>
                      <b>
                        {scoreboard.duelRoom.sources[0]
                          ? `${shareSourceLabel(scoreboard.duelRoom.sources[0].source, locale)} · ${scoreboard.duelRoom.sources[0].count}`
                          : "—"}
                      </b>
                    </article>
                  </div>
                  {(() => {
                    const reached = Math.max(
                      scoreboard.duelRoom.viewCount,
                      scoreboard.duelRoom.startCount,
                      scoreboard.duelRoom.responseCount,
                    );
                    const started = Math.max(
                      scoreboard.duelRoom.startCount,
                      scoreboard.duelRoom.responseCount,
                    );
                    const stages = [
                      [locale === "en" ? "VIEWED" : "已打开", reached],
                      [locale === "en" ? "STARTED" : "已开始", started],
                      [
                        locale === "en" ? "FINISHED" : "已完成",
                        scoreboard.duelRoom.responseCount,
                      ],
                      [
                        locale === "en" ? "RELAYED" : "已接力",
                        scoreboard.duelRoom.rematchCount,
                      ],
                    ] as const;
                    return (
                      <section className="duel-room-funnel" aria-label={
                        locale === "en"
                          ? "Friend challenge conversion funnel"
                          : "好友挑战转化漏斗"
                      }>
                        <header>
                          <div>
                            <small>{locale === "en" ? "CHALLENGE JOURNEY" : "好友传播进度"}</small>
                            <b>
                              {reached
                                ? locale === "en"
                                  ? `${scoreboard.duelRoom.responseCount} of ${reached} visitors finished`
                                  : `${reached} 人打开，${scoreboard.duelRoom.responseCount} 人完成`
                                : locale === "en"
                                  ? "Share once to start the chain"
                                  : "分享一次，开始第一轮接力"}
                            </b>
                          </div>
                          <strong>
                            {reached
                              ? `${Math.round((scoreboard.duelRoom.responseCount / reached) * 100)}%`
                              : "—"}
                          </strong>
                        </header>
                        <div>
                          {stages.map(([label, value]) => (
                            <article key={label}>
                              <span>
                                <small>{label}</small>
                                <b>{value}</b>
                              </span>
                              <i>
                                <em
                                  style={{
                                    width: `${reached ? Math.max(value ? 8 : 0, Math.min(100, (value / reached) * 100)) : 0}%`,
                                  }}
                                />
                              </i>
                            </article>
                          ))}
                        </div>
                      </section>
                    );
                  })()}
                  <p className="duel-spoiler-note">
                    {locale === "en"
                      ? "The room reveals scores only. The ticker, answer, and every player’s trades stay spoiler-free."
                      : "擂台只公开分数；股票身份、答案和每位玩家的交易仍保持无剧透。"}
                  </p>
                  <div className="duel-invite-actions">
                    <button className="duel-accept" onClick={() => void shareDuelRoom()}>
                      {duelRoomShareStatus ||
                        (locale === "en" ? "Share this duel again →" : "继续分享这个擂台 →")}
                    </button>
                    <button className="duel-decline" onClick={() => setDuelInviteOpen(false)}>
                      {locale === "en" ? "Close" : "关闭"}
                    </button>
                  </div>
                </>
              ) : !scoreboard.duelRoom.challengerFinished ? (
                <>
                  <header>
                    <small>
                      {scoreboard.duelRoom.isHost
                        ? locale === "en"
                          ? "YOUR PRIVATE DUEL"
                          : "你的私密对决"
                        : locale === "en"
                          ? "LIVE FRIEND DUEL"
                          : "好友实时对决"}
                    </small>
                    <span>{locale === "en" ? "ROOM OPEN" : "房间已开放"}</span>
                  </header>
                  <div className="duel-challenger">
                    <i>⚔</i>
                    <div>
                      <h2 id="duel-invite-title">
                        {scoreboard.duelRoom.isHost
                          ? locale === "en"
                            ? "Invite now. Play in parallel."
                            : "现在邀请好友，同时完成挑战"
                          : locale === "en"
                            ? `${scoreboard.duelRoom.challengerNickname} is playing now`
                            : `${scoreboard.duelRoom.challengerNickname} 正在作答`}
                      </h2>
                      <p>
                        {locale === "en"
                          ? "Both players get the exact same hidden historical chart. Neither score is needed before the room opens."
                          : "双方获得完全相同的隐藏历史行情；无需等待任何一方先完成，房间立即可玩。"}
                      </p>
                    </div>
                  </div>
                  <div className="duel-invite-rules">
                    <article><i>01</i><b>{locale === "en" ? "Invite" : "邀请"}</b><span>{locale === "en" ? "Room is live" : "房间立即生效"}</span></article>
                    <article><i>02</i><b>{locale === "en" ? "Race" : "同时作答"}</b><span>{locale === "en" ? "Five decisions" : "各做五次决策"}</span></article>
                    <article><i>03</i><b>{locale === "en" ? "Compare" : "对比"}</b><span>{locale === "en" ? "Verified scores" : "服务器复算"}</span></article>
                  </div>
                  <p className="duel-spoiler-note">
                    {locale === "en"
                      ? "The ticker, future candles, trades, and unfinished scores stay hidden. No sign-up required."
                      : "股票、后续走势、交易和未完成成绩全部保持隐藏；无需注册。"}
                  </p>
                  <div className="duel-invite-actions">
                    <button
                      className="duel-accept"
                      onClick={
                        scoreboard.duelRoom.isHost
                          ? () => void shareDuelRoom()
                          : acceptDuelInvite
                      }
                    >
                      {scoreboard.duelRoom.isHost
                        ? duelRoomShareStatus ||
                          (locale === "en" ? "Invite a friend now →" : "立即邀请好友 →")
                        : locale === "en"
                          ? "Join the race →"
                          : "加入同图竞速 →"}
                    </button>
                    <button
                      className="duel-decline"
                      onClick={scoreboard.duelRoom.isHost ? acceptDuelInvite : leaveDuel}
                    >
                      {scoreboard.duelRoom.isHost
                        ? locale === "en"
                          ? "Start my five decisions"
                          : "开始我的五次决策"
                        : locale === "en"
                          ? "Leave this duel"
                          : "退出本次对决"}
                    </button>
                  </div>
                </>
              ) : scoreboard.opponent ? (
                <>
                  <header>
                    <small>
                      {locale === "en"
                        ? `CHALLENGE CHAIN · ROUND ${(initialDuel?.chainDepth ?? 0) + 1}`
                        : `好友挑战接力 · 第 ${(initialDuel?.chainDepth ?? 0) + 1} 轮`}
                    </small>
                    <span>
                      {scoreboard.duelRoom?.responseCount
                        ? locale === "en"
                          ? `${scoreboard.duelRoom.responseCount} ANSWERED`
                          : `${scoreboard.duelRoom.responseCount} 人已应战`
                        : locale === "en"
                          ? "ABOUT 90 SEC"
                          : "约 90 秒"}
                    </span>
                  </header>
                  <div className="duel-challenger">
                    <i>{scoreboard.opponent.nickname.slice(0, 1).toUpperCase()}</i>
                    <div>
                      <h2 id="duel-invite-title">
                        {locale === "en"
                          ? `${scoreboard.opponent.nickname} scored ${scoreboard.opponent.score}`
                          : `${scoreboard.opponent.nickname} 得到 ${scoreboard.opponent.score} 分`}
                      </h2>
                      <p>
                        {locale === "en"
                          ? "The exact same mystery chart is waiting for your read."
                          : "完全相同的神秘历史行情，正在等待你的判断。"}
                      </p>
                    </div>
                  </div>
                  <div className="duel-target-score">
                    <small>{locale === "en" ? "SCORE TO BEAT" : "目标分数"}</small>
                    <strong>{scoreboard.opponent.score}</strong>
                    <span>
                      {locale === "en"
                        ? `Top ${Math.max(1, 100 - (scoreboard.opponent.percentile ?? 0))}% today`
                        : `今日领先 ${scoreboard.opponent.percentile ?? 0}% 玩家`}
                    </span>
                  </div>
                  <div className="duel-invite-rules">
                    <article><i>01</i><b>{locale === "en" ? "Read" : "读图"}</b><span>{locale === "en" ? "Ticker hidden" : "隐藏股票身份"}</span></article>
                    <article><i>02</i><b>{locale === "en" ? "Call" : "判断"}</b><span>{locale === "en" ? "Five decisions" : "完成五次决策"}</span></article>
                    <article><i>03</i><b>{locale === "en" ? "Compare" : "对比"}</b><span>{locale === "en" ? "Reveal both scores" : "结算后揭晓双方"}</span></article>
                  </div>
                  <p className="duel-spoiler-note">
                    {locale === "en"
                      ? "Their trades, returns, and the ticker stay hidden until you finish. No sign-up required."
                      : "对方交易、收益和股票身份都会隐藏到你完成挑战；无需注册。"}
                  </p>
                  <div className="duel-invite-actions">
                    <button className="duel-accept" onClick={acceptDuelInvite}>
                      {locale === "en"
                        ? `Accept · beat ${scoreboard.opponent.score} →`
                        : `接受挑战 · 超过 ${scoreboard.opponent.score} 分 →`}
                    </button>
                    <button className="duel-decline" onClick={leaveDuel}>
                      {locale === "en" ? "Play without the duel" : "退出对决，普通游玩"}
                    </button>
                  </div>
                </>
              ) : null}
            </section>
          </dialog>
        )}


      {trainingOpen && (
        <dialog
          open
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setTrainingOpen(false);
          }}
        >
          <section className="training-modal">
            <button
              className="modal-close"
              onClick={() => setTrainingOpen(false)}
            >
              ×
            </button>
            <small className="eyebrow">SCENARIO LAB · 针对性训练</small>
            <h2>今天想练哪一种行情？</h2>
            <p>
              系统从真实历史中筛选典型片段。你会提前看到训练目标，但股票身份、日期和后续走势仍然隐藏。
            </p>
            <section className={`daily-missions ${dailyMission.completed === 3 ? "complete" : ""}`}>
              <div className="daily-mission-head">
                <div>
                  <small>DAILY ROUTINE · 今日训练</small>
                  <b>{dailyMission.completed === 3 ? "今日训练闭环已完成" : `完成 ${dailyMission.completed}/3 项`}</b>
                </div>
                <span>{dailyMission.rewardXp ? "+60 XP 已获得" : "全部完成 +60 XP"}</span>
              </div>
              <div className="daily-task-list">
                <div className={dailyMission.quiz >= 1 ? "done" : ""}>
                  <i>{dailyMission.quiz >= 1 ? "✓" : "01"}</i>
                  <span>完成 1 道形态盲测</span>
                  <b>{dailyMission.quiz}/1</b>
                </div>
                <div className={dailyMission.days >= 15 ? "done" : ""}>
                  <i>{dailyMission.days >= 15 ? "✓" : "02"}</i>
                  <span>完成 15 日概率决策训练</span>
                  <b>{dailyMission.days}/15</b>
                </div>
                <div className={dailyMission.training >= 1 ? "done" : ""}>
                  <i>{dailyMission.training >= 1 ? "✓" : "03"}</i>
                  <span>完成 1 局情景训练</span>
                  <b>{dailyMission.training}/1</b>
                </div>
              </div>
            </section>
            <button
              className="quiz-entry"
              disabled={quizLoading || !playerId}
              onClick={() => void startQuiz()}
            >
              <span>
                <small>PATTERN QUIZ · 形态识别盲测</small>
                <b>不告诉你行情类型，只凭 120 根真实 K 线作答</b>
              </span>
              <i>{quizLoading ? "正在抽题…" : "开始盲测 →"}</i>
            </button>
            <div className="quiz-level-row">
              <span>盲测难度</span>
              <div>
                {(["starter", "standard", "expert"] as const).map((value) => (
                  <button
                    key={value}
                    className={selectedDifficulty === value ? "selected" : ""}
                    onClick={() => setSelectedDifficulty(value)}
                  >
                    {DIFFICULTY_CONFIG[value].label}
                  </button>
                ))}
              </div>
              {weakestRecognition && (
                <button
                  className="mistake-retry"
                  disabled={quizLoading}
                  onClick={() => void startQuiz(weakestRecognition)}
                >
                  错题重练 · {SCENARIO_CONFIG[weakestRecognition].title}（
                  {trainingProfile?.recognition.mistakes || 0}）
                </button>
              )}
            </div>
            <div className="course-head">
              <div>
                <small>MASTERY PATH · 12 课训练树</small>
                <b>从认识行情，到在压力下执行</b>
              </div>
              <span>{trainingProfile?.mastered || 0}/12 已掌握</span>
            </div>
            <div className="course-tree">
              {(["starter", "standard", "expert"] as const).map(
                (difficulty) => (
                  <article key={difficulty}>
                    <header>
                      <span>{DIFFICULTY_CONFIG[difficulty].label}</span>
                      <small>
                        {DIFFICULTY_CONFIG[difficulty].days} 日 · 回撤
                        {DIFFICULTY_CONFIG[difficulty].drawdown}%
                      </small>
                    </header>
                    {(Object.keys(SCENARIO_CONFIG) as QuizScenario[]).map(
                      (scenario) => {
                        const passes =
                          scenarioProgress[`${scenario}:${difficulty}`] || 0;
                        const locked =
                          difficulty === "expert" &&
                          !scenarioProgress[`${scenario}:standard`];
                        return (
                          <button
                            key={scenario}
                            className={`${passes ? "mastered" : ""} ${locked ? "locked" : ""}`}
                            disabled={challengeLoading || locked}
                            onClick={() => {
                              setSelectedDifficulty(difficulty);
                              void resetGame(
                                "practice",
                                market,
                                scenario,
                                difficulty,
                              );
                            }}
                          >
                            <i>{passes ? "✓" : locked ? "锁" : "·"}</i>
                            <span>{SCENARIO_CONFIG[scenario].title}</span>
                            <b>{passes ? `${passes} 次` : locked ? "先过标准" : "开始"}</b>
                          </button>
                        );
                      },
                    )}
                  </article>
                ),
              )}
            </div>
            <button
              className="random-training"
              disabled={challengeLoading}
              onClick={() => void resetGame("practice", market, "random")}
            >
              不指定情景，开始随机综合训练
            </button>
            <div className="interval-roadmap">
              <div>
                <b>日 K 经典训练</b>
                <span>已开放 · 覆盖完整历史周期</span>
              </div>
              <div>
                <b>15 分钟事件局</b>
                <span>内测 · 仅接入合规分钟数据后开放</span>
              </div>
              <div>
                <b>5 分钟快节奏</b>
                <span>内测 · 不使用伪造或拼接行情</span>
              </div>
            </div>
          </section>
        </dialog>
      )}

      {quizOpen && patternQuiz && (
        <dialog open className="modal-backdrop quiz-backdrop">
          <section className="quiz-modal">
            <button
              className="modal-close"
              onClick={() => setQuizOpen(false)}
            >
              ×
            </button>
            <small className="eyebrow">PATTERN QUIZ · 真实行情盲测</small>
            <div className="quiz-heading">
              <div>
                <h2>这段行情最接近哪一种？</h2>
                <p>
                  股票与日期隐藏。先识别市场状态，再决定下一局该采用什么策略。
                </p>
              </div>
              <span>{DIFFICULTY_CONFIG[patternQuiz.difficulty].label}</span>
            </div>
            <div className="quiz-chart">
              <CandleChart
                data={patternQuiz.stock.candles}
                markers={[]}
                market={patternQuiz.market}
                locale={locale}
              />
            </div>
            <div
              className="quiz-options"
              role="group"
              aria-label="选择行情形态"
            >
              {(Object.keys(SCENARIO_CONFIG) as QuizScenario[]).map((value) => (
                <button
                  key={value}
                  disabled={Boolean(quizResult)}
                  className={`${quizAnswer === value ? "selected" : ""} ${quizResult?.actual === value ? "correct" : ""} ${quizResult && quizAnswer === value && !quizResult.correct ? "wrong" : ""}`}
                  onClick={() => setQuizAnswer(value)}
                >
                  <b>{SCENARIO_CONFIG[value].title}</b>
                  <small>{SCENARIO_CONFIG[value].description}</small>
                </button>
              ))}
            </div>
            {!quizResult ? (
              <>
                <div className="quiz-confidence">
                  <span>你的信心</span>
                  <div>
                    {([1, 2, 3] as const).map((value) => (
                      <button
                        key={value}
                        className={quizConfidence === value ? "selected" : ""}
                        onClick={() => setQuizConfidence(value)}
                      >
                        {value === 1 ? "低" : value === 2 ? "中" : "高"}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  className="primary-action"
                  disabled={!quizAnswer || quizLoading}
                  onClick={() => void submitQuiz()}
                >
                  {quizLoading ? "正在核对真实样本…" : "提交判断并查看证据"}
                </button>
              </>
            ) : (
              <div className={`quiz-result ${quizResult.correct ? "hit" : "miss"}`}>
                <div>
                  <span>{quizResult.correct ? "识别正确" : "识别偏差"}</span>
                  <b>系统标签：{SCENARIO_CONFIG[quizResult.actual].title}</b>
                </div>
                <p>{quizResult.explanation}</p>
                <small>
                  样本揭晓：{quizResult.identity.name} · {quizResult.identity.code}
                  · {quizResult.identity.from}—{quizResult.identity.to}
                </small>
                <div>
                  <button
                    onClick={() =>
                      void startQuiz(
                        quizResult.correct ? undefined : quizResult.actual,
                      )
                    }
                  >
                    {quizResult.correct ? "再来一道" : "针对错因再练"}
                  </button>
                  <button
                    onClick={() => {
                      setQuizOpen(false);
                      void resetGame(
                        "practice",
                        patternQuiz.market,
                        quizResult.actual,
                        patternQuiz.difficulty,
                      );
                    }}
                  >
                    进入同类实战
                  </button>
                </div>
              </div>
            )}
          </section>
        </dialog>
      )}

      {rulesOpen && (
        <dialog
          open
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setRulesOpen(false);
          }}
        >
          <section className="rules-modal">
            <button className="modal-close" onClick={() => setRulesOpen(false)}>
              ×
            </button>
            <small>HOW TO PLAY</small>
            <h2>在真实牛熊周期里做决策</h2>
            <ol>
              <li>
                <b>市场</b>
                <span>
                  可随时选择 A 股或美股；A 股从{" "}
                  {MARKET_UNIVERSE_SIZE.cn.toLocaleString(numberLocale)}{" "}
                  只全市场股票池中抽取。
                </span>
              </li>
              <li>
                <b>观察</b>
                <span>
                  开局提供 120 根真实日
                  K，覆盖约半年走势，股票身份和历史日期隐藏。
                </span>
              </li>
              <li>
                <b>委托</b>
                <span>
                  仅支持市价买卖，可选
                  1/4、1/3、1/2、3/4、全仓，也可直接输入股数；统一在下一交易日开盘成交。
                </span>
              </li>
              <li>
                <b>交易单位</b>
                <span>
                  A 股买卖按 100
                  股整手处理，美股按整数股处理；不允许超出可用资金或当前持仓。
                </span>
              </li>
              <li>
                <b>成交成本</b>
                <span>
                  交易按次日开盘价加入透明滑点，并从现金中扣除对应市场的税费与监管费；券商佣金属于游戏模拟参数，可在委托区展开查看。
                </span>
              </li>
              <li>
                <b>持有</b>
                <span>
                  每次选择向前推进 1、3 或 5
                  个真实交易日，期间仓位不变、净值逐日计算。
                </span>
              </li>
              <li>
                <b>周期</b>
                <span>
                  今日挑战固定为 5 次决策，约 90 秒完成；无限练习与情境训练可持续到完整历史终点，也可以随时提前结束。
                </span>
              </li>
              <li>
                <b>判断</b>
                <span>
                  每次推进前锁定涨、震、跌概率与判断依据；概率越激进，误判时校准损失越大，观望同样是有效决策。
                </span>
              </li>
              <li>
                <b>形态盲测</b>
                <span>
                  系统从真实历史筛选题目，但不提前告知情景；作答后揭晓系统标签、股票身份、日期与识别证据，高信心误判会进入长期画像。
                </span>
              </li>
              <li>
                <b>情景训练</b>
                <span>
                  12 课训练树覆盖趋势、拐点、急跌和高波动的入门、标准、专家难度；专家课需先通过对应标准课。
                </span>
              </li>
              <li>
                <b>每日任务</b>
                <span>
                  每日完成 1 道盲测、15 日概率决策和 1 局情景训练，可获得 60 XP；误判会自动进入错题重练。
                </span>
              </li>
              <li>
                <b>评分</b>
                <span>
                  风险控制30%、概率校准30%、交易纪律25%、执行质量10%、风险调整收益5%；收益不再主导评分。
                </span>
              </li>
              <li>
                <b>每周联赛</b>
                <span>
                  A 股与美股分开排名，每周取个人最佳 5 局累计积分；完成 3 局、2 局概率契约和 1 局低回撤目标可获得 120 XP。
                </span>
              </li>
              <li>
                <b>成长成就</b>
                <span>
                  正式局、风险纪录、形态识别、训练课程和好友挑战共同解锁 10 项云端成就；每项奖励只计入一次。
                </span>
              </li>
              <li>
                <b>同图对决</b>
                <span>
                  正式成绩结算后生成匿名挑战码；好友进入后看到完全相同的历史 K 线，双方完成后立即比较服务器复算得分。
                </span>
              </li>
              <li>
                <b>复盘</b>
                <span>
                  结算后揭晓真实股票、交易所和日期，并按时间线逐笔对照判断与后续走势；未完成会话和情景训练成绩会同步到云端。
                </span>
              </li>
            </ol>
            <button
              className="primary-action"
              onClick={() => setRulesOpen(false)}
            >
              继续挑战
            </button>
          </section>
        </dialog>
      )}

      {scoreboardOpen && (
        <dialog
          open
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setScoreboardOpen(false);
          }}
        >
          <section className="leaderboard-modal">
            <button
              className="modal-close"
              onClick={() => setScoreboardOpen(false)}
            >
              ×
            </button>
            <small className="eyebrow">
              COMPETITION HUB · {marketLabel}竞技中心
            </small>
            <div className="player-editor">
              <span>{nickname.slice(0, 1)}</span>
              <div>
                <small>我的盲盘名</small>
                <input
                  value={nickname}
                  maxLength={12}
                  onChange={(event) => setNickname(event.target.value)}
                  onBlur={() => {
                    const name =
                      nickname.trim() ||
                      (locale === "en"
                        ? `Reader-${playerId.slice(-4).toUpperCase()}`
                        : `盲盘客${playerId.slice(-4).toUpperCase()}`);
                    setNickname(name);
                    safeLocalStorage.setItem("mangpan-player-name", name);
                  }}
                />
              </div>
            </div>
            {scoreboard?.stats && (
              <>
                <div className="career-grid">
                  <div>
                    <b>{scoreboard.stats.streak}</b>
                    <small>连续挑战</small>
                  </div>
                  <div>
                    <b>{scoreboard.stats.completedDays}</b>
                    <small>完成天数</small>
                  </div>
                  <div>
                    <b>{scoreboard.stats.averageScore}</b>
                    <small>平均评分</small>
                  </div>
                  <div>
                    <b>{scoreboard.stats.bestScore}</b>
                    <small>最佳评分</small>
                  </div>
                </div>
                <section
                  className={`career-freeze-card ${
                    streakProtection.freezeUsedToday ||
                    streakProtection.protectedMissedDays
                      ? "protected"
                      : ""
                  }`}
                >
                  <span aria-hidden="true">◇</span>
                  <div>
                    <small>
                      {locale === "en"
                        ? "STREAK PROTECTION"
                        : "连续挑战保护"}
                    </small>
                    <b>
                      {streakProtection.availableFreezes}/2{" "}
                      {locale === "en" ? "freezes ready" : "次保护可用"}
                    </b>
                    <p>
                      {streakProtection.protectedMissedDays
                        ? locale === "en"
                          ? "A freeze is holding your streak. Finish today to keep it moving."
                          : "保护已为你保住连续记录，完成今天的挑战即可继续。"
                        : streakProtection.availableFreezes >= 2
                          ? locale === "en"
                            ? "Protection is full. Two missed days can be covered automatically."
                            : "保护已满，可自动覆盖两次漏玩的日期。"
                          : locale === "en"
                            ? `Next freeze in ${streakProtection.nextFreezeIn} daily challenges.`
                            : `再完成 ${streakProtection.nextFreezeIn} 次每日挑战获得下一次保护。`}
                    </p>
                  </div>
                </section>
                <div className="profile-card career-profile">
                  <small>近 7 局决策画像</small>
                  <b>{scoreboard.stats.profile.title}</b>
                  <p>{scoreboard.stats.profile.text}</p>
                </div>
                <section className="personal-records">
                  <div>
                    <small>跑赢基准</small>
                    <b>{scoreboard.stats.records.benchmarkWins} 局</b>
                  </div>
                  <div>
                    <small>低回撤局</small>
                    <b>{scoreboard.stats.records.riskControlled} 局</b>
                  </div>
                  <div>
                    <small>累计成交</small>
                    <b>{scoreboard.stats.records.totalTrades} 次</b>
                  </div>
                  <div>
                    <small>单局最佳收益</small>
                    <b className={scoreboard.stats.records.bestReturn >= 0 ? "up" : "down"}>
                      {scoreboard.stats.records.bestReturn >= 0 ? "+" : ""}
                      {scoreboard.stats.records.bestReturn.toFixed(1)}%
                    </b>
                  </div>
                </section>
                <div className="growth-track">
                  <div>
                    <span>交易等级 LV.{scoreboard.stats.level}</span>
                    <b>{scoreboard.stats.xp} XP</b>
                  </div>
                  <i>
                    <em
                      style={{
                        width: `${scoreboard.stats.levelProgress / 3}%`,
                      }}
                    />
                  </i>
                  <small>
                    再获得 {300 - scoreboard.stats.levelProgress} XP 升级 ·
                    正式局、任务、联赛与成就共同积累
                  </small>
                </div>
                <details className="achievement-wall">
                  <summary>
                    <span>
                      <small>ACHIEVEMENT WALL · 云端成就</small>
                      <b>已解锁 {scoreboard.stats.unlockedAchievements}/10</b>
                    </span>
                    <strong>+{scoreboard.stats.achievementXp} XP · 展开查看</strong>
                  </summary>
                  <div className="achievement-grid">
                    {scoreboard.stats.achievements.map((achievement) => (
                      <article
                        key={achievement.key}
                        className={achievement.unlocked ? "unlocked" : "locked"}
                      >
                        <i>{achievement.unlocked ? "✓" : achievement.badge}</i>
                        <div>
                          <b>{achievement.title}</b>
                          <small>{achievement.description}</small>
                          <span>
                            <em
                              style={{
                                width: `${Math.min(100, (achievement.progress / achievement.target) * 100)}%`,
                              }}
                            />
                          </span>
                        </div>
                        <strong>
                          {achievement.progress}/{achievement.target}
                          <small>+{achievement.rewardXp} XP</small>
                        </strong>
                      </article>
                    ))}
                  </div>
                </details>
                <section className="cloud-training-card">
                  <div className="cloud-training-head">
                    <div>
                      <small>CLOUD TRAINING DNA</small>
                      <b>{marketLabel}云端训练档案</b>
                    </div>
                    <span>自动同步</span>
                  </div>
                  <div className="cloud-training-summary">
                    <div>
                      <b>{scoreboard.stats.training.attempts}</b>
                      <small>训练次数</small>
                    </div>
                    <div>
                      <b>{scoreboard.stats.training.passes}</b>
                      <small>累计通关</small>
                    </div>
                    <div>
                      <b>{scoreboard.stats.training.mastered}/12</b>
                      <small>已掌握课目</small>
                    </div>
                    <div>
                      <b>{scoreboard.stats.training.totalDays}</b>
                      <small>训练交易日</small>
                    </div>
                  </div>
                  <div className="recognition-summary">
                    <span>形态识别</span>
                    <b>
                      {scoreboard.stats.training.recognition.attempts
                        ? `${scoreboard.stats.training.recognition.accuracy}%`
                        : "等待首题"}
                    </b>
                    <small>
                      {scoreboard.stats.training.recognition.correct}/
                      {scoreboard.stats.training.recognition.attempts} 命中 · 高信心误判{" "}
                      {
                        scoreboard.stats.training.recognition
                          .highConfidenceMisses
                      }{" "}
                      次
                    </small>
                  </div>
                  <div className="cloud-ability-list">
                    {(
                      [
                        ["风险", scoreboard.stats.training.ability.risk],
                        ["校准", scoreboard.stats.training.ability.calibration],
                        ["执行", scoreboard.stats.training.ability.execution],
                        ["纪律", scoreboard.stats.training.ability.discipline],
                        ["收益", scoreboard.stats.training.ability.performance],
                      ] as const
                    ).map(([label, value]) => (
                      <div key={label}>
                        <span>{label}</span>
                        <i>
                          <em style={{ width: `${value}%` }} />
                        </i>
                        <b>{value || "—"}</b>
                      </div>
                    ))}
                  </div>
                </section>
              </>
            )}
            <div className="board-tabs" role="tablist" aria-label="选择竞技榜单">
              <button
                role="tab"
                aria-selected={boardTab === "daily"}
                className={boardTab === "daily" ? "active" : ""}
                onClick={() => setBoardTab("daily")}
              >
                今日同题榜
              </button>
              <button
                role="tab"
                aria-selected={boardTab === "weekly"}
                className={boardTab === "weekly" ? "active" : ""}
                onClick={() => setBoardTab("weekly")}
              >
                本周联赛
              </button>
            </div>
            {boardTab === "daily" ? (
              <>
                <div className="board-head">
                  <b>{marketLabel}今日排行榜</b>
                  <span>{scoreboard?.total || 0} 人完成</span>
                </div>
                <div className="board-list">
                  {scoreboard?.leaderboard.length ? (
                    scoreboard.leaderboard.map((item) => (
                      <div
                        key={`${item.rank}-${item.nickname}`}
                        className={item.isPlayer ? "me" : ""}
                      >
                        <i>
                          {item.rank <= 3
                            ? ["🥇", "🥈", "🥉"][item.rank - 1]
                            : item.rank}
                        </i>
                        <span>
                          {item.nickname}
                          {item.isPlayer && <em>我</em>}
                        </span>
                        <b>{item.score}</b>
                        <small className={item.returnRate >= 0 ? "up" : "down"}>
                          {item.returnRate >= 0 ? "+" : ""}
                          {item.returnRate.toFixed(1)}%
                        </small>
                      </div>
                    ))
                  ) : (
                    <p className="board-empty">
                      还没有人完成今日挑战，等你成为第一名。
                    </p>
                  )}
                </div>
                <p className="board-note">
                  排名按服务器复算的首次正式成绩生成；A股与美股分榜，股票身份在结算前隐藏。
                </p>
              </>
            ) : (
              <>
                <div className="weekly-season-card">
                  <div>
                    <small>WEEKLY LEAGUE · 最佳 5 局</small>
                    <b>
                      {scoreboard?.weekly.start.slice(5)} — {scoreboard?.weekly.end.slice(5)}
                    </b>
                  </div>
                  {scoreboard?.weekly.player ? (
                    <strong>
                      第 {scoreboard.weekly.player.rank} 名 · {scoreboard.weekly.player.points} 分
                    </strong>
                  ) : (
                    <strong>完成今日挑战即可入榜</strong>
                  )}
                </div>
                <section
                  className={`weekly-mission ${scoreboard?.weekly.mission.completed === 3 ? "complete" : ""}`}
                >
                  <div className="weekly-mission-head">
                    <span>
                      <small>WEEKLY OBJECTIVES · 周目标</small>
                      <b>完成 {scoreboard?.weekly.mission.completed || 0}/3 项</b>
                    </span>
                    <strong>
                      {scoreboard?.weekly.mission.rewardXp
                        ? "+120 XP 已获得"
                        : "全部完成 +120 XP"}
                    </strong>
                  </div>
                  <div className="weekly-task-list">
                    <div className={(scoreboard?.weekly.mission.games || 0) >= 3 ? "done" : ""}>
                      <i>{(scoreboard?.weekly.mission.games || 0) >= 3 ? "✓" : "01"}</i>
                      <span>完成 3 局正式挑战</span>
                      <b>{scoreboard?.weekly.mission.games || 0}/3</b>
                    </div>
                <div className={(scoreboard?.weekly.mission.contractGames || 0) >= 2 ? "done" : ""}>
                      <i>{(scoreboard?.weekly.mission.contractGames || 0) >= 2 ? "✓" : "02"}</i>
                      <span>2 局完成至少 3 次概率契约</span>
                      <b>{scoreboard?.weekly.mission.contractGames || 0}/2</b>
                    </div>
                    <div className={(scoreboard?.weekly.mission.riskControlled || 0) >= 1 ? "done" : ""}>
                      <i>{(scoreboard?.weekly.mission.riskControlled || 0) >= 1 ? "✓" : "03"}</i>
                      <span>1 局有交易且回撤 ≤ 5%</span>
                      <b>{scoreboard?.weekly.mission.riskControlled || 0}/1</b>
                    </div>
                  </div>
                </section>
                <div className="board-head">
                  <b>{marketLabel}本周联赛</b>
                  <span>{scoreboard?.weekly.total || 0} 人参赛</span>
                </div>
                <div className="board-list weekly-board-list">
                  {scoreboard?.weekly.leaderboard.length ? (
                    scoreboard.weekly.leaderboard.map((item) => (
                      <div
                        key={`${item.rank}-${item.nickname}`}
                        className={item.isPlayer ? "me" : ""}
                      >
                        <i>
                          {item.rank <= 3
                            ? ["🥇", "🥈", "🥉"][item.rank - 1]
                            : item.rank}
                        </i>
                        <span>
                          {item.nickname}
                          {item.isPlayer && <em>我</em>}
                          <small>{item.completedDays}/5 局 · 均分 {item.averageScore}</small>
                        </span>
                        <b>{item.points}</b>
                        <small>积分</small>
                      </div>
                    ))
                  ) : (
                    <p className="board-empty">本周联赛等待第一位参赛者。</p>
                  )}
                </div>
                <p className="board-note">{scoreboard?.weekly.rule}</p>
              </>
            )}
          </section>
        </dialog>
      )}

      {resultOpen && (
        <div className="modal-backdrop result-backdrop">
          <section className="result-modal">
            <header className="result-heading">
              <div>
            <small className="eyebrow">
              {isMarketRun
                ? locale === "en"
                  ? `MARKET RUN · STAGE ${Math.max(1, marketRunCompletedStages)}/${MARKET_RUN_STAGES.length}`
                  : `市场闯关 · 第 ${Math.max(1, marketRunCompletedStages)}/${MARKET_RUN_STAGES.length} 关`
                : isQuickRead
                ? `${marketLabel}Quick Read`
                : isEndlessMode
                ? `${marketLabel}Endless · 长周期`
                : gameMode === "daily"
                ? `${marketLabel}今日盲盘 #${today.slice(5).replace("-", "")}`
                : `${marketLabel}${scenarioLabel}`}{" "}
              · 股票揭晓
            </small>
            <h1>{stock.name}</h1>
            <p className="stock-code">
              {stock.market} · {stock.code}
            </p>
              </div>
              <button
                className="result-close"
                onClick={() => setResultOpen(false)}
                aria-label="关闭战绩并返回复盘 K 线"
              >
                <span aria-hidden="true">←</span>
                返回 K 线
              </button>
            </header>
            {celebration && celebrationCopy && (
              <section
                className={`milestone-celebration ${celebration}`}
                role="status"
                aria-live="polite"
              >
                <div className="milestone-confetti" aria-hidden="true">
                  {Array.from({ length: 12 }, (_, index) => (
                    <i key={index} />
                  ))}
                </div>
                <span className="milestone-seal" aria-hidden="true">✦</span>
                <div>
                  <small>{celebrationCopy.eyebrow}</small>
                  <b>{celebrationCopy.title}</b>
                  <p>{celebrationCopy.body}</p>
                </div>
                <button
                  type="button"
                  aria-label={
                    locale === "zh" ? "关闭里程碑庆祝" : "Dismiss celebration"
                  }
                  onClick={() => setCelebration(null)}
                >
                  ×
                </button>
              </section>
            )}
            <div className="result-overview">
            <div
              className={`result-hero ${returnRate >= 0 ? "positive" : "negative"}`}
            >
              <span>最终收益</span>
              <strong>
                {returnRate >= 0 ? "+" : ""}
                {returnRate.toFixed(2)}%
              </strong>
              <small>
                期初 {currencySymbol}{nf.format(INITIAL_CASH)}
                <i aria-hidden="true">→</i>
                期末 {currencySymbol}{nf.format(equity)}
              </small>
            </div>
            <div className="result-grid">
              <div>
                <small>操盘评分</small>
                <b>{skillScore}</b>
                <span>决策过程</span>
              </div>
              <div>
                <small>股票同期</small>
                <b className={benchmark >= 0 ? "up" : "down"}>
                  {benchmark >= 0 ? "+" : ""}
                  {benchmark.toFixed(2)}%
                </b>
                <span>买入并持有</span>
              </div>
              <div>
                <small>超额收益</small>
                <b className={excess >= 0 ? "up" : "down"}>
                  {excess >= 0 ? "+" : ""}
                  {excess.toFixed(2)}%
                </b>
                <span>相对同期</span>
              </div>
              <div>
                <small>最大回撤</small>
                <b>{maxDrawdown.toFixed(2)}%</b>
                <span>峰值至谷底</span>
              </div>
            </div>
            </div>
            {showSessionMomentum && (
              <section
                className={`result-session-goal ${sessionChainCount >= 3 ? "complete" : ""}`}
              >
                <div className="result-session-copy">
                  <small>
                    {locale === "zh" ? "本次连续挑战" : "SESSION MOMENTUM"}
                  </small>
                  <b>
                    {sessionChainCount >= 3
                      ? locale === "zh"
                        ? "三图连续目标已完成"
                        : "Three-chart streak complete"
                      : locale === "zh"
                        ? "连续读完三张图，建立第一份判断样本"
                        : "Read three charts to build your first real sample"}
                  </b>
                  <span>
                    {locale === "zh"
                      ? "下一张是全新隐藏行情，不会改变今天已经锁定的成绩。"
                      : "A fresh hidden chart is ready. Today’s locked score will not change."}
                  </span>
                </div>
                <div
                  className="result-session-progress"
                  aria-label={
                    locale === "zh" ? "三图连续进度" : "Three-chart session progress"
                  }
                >
                  <strong>{Math.min(sessionChainCount, 3)}/3</strong>
                  <span>{locale === "zh" ? "张图已完成" : "CHARTS CLEARED"}</span>
                  <div aria-hidden="true">
                    {Array.from({ length: 3 }, (_, index) => (
                      <i
                        className={index < sessionChainCount ? "complete" : ""}
                        key={index}
                      />
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={
                    challengeLoading ||
                    (gameMode === "daily" && scoreStatus !== "done")
                  }
                  onClick={() => void continueAfterResult()}
                >
                  {challengeLoading
                    ? locale === "zh"
                      ? "正在载入下一张图…"
                      : "Loading next chart…"
                    : gameMode === "daily" && scoreStatus !== "done"
                      ? locale === "zh"
                        ? "正在锁定今日成绩…"
                        : "Locking today’s score…"
                      : locale === "zh"
                        ? "下一张神秘图 →"
                        : "Next mystery chart →"}
                </button>
              </section>
            )}
            {isMarketRun && (
              <section
                className={`market-run-result ${marketRunFinished ? "complete" : ""}`}
              >
                <header>
                  <div>
                    <small>
                      {marketRunFinished
                        ? locale === "en"
                          ? "RUN COMPLETE"
                          : "闯关完成"
                        : locale === "en"
                          ? `MARKET ${marketRunCompletedStages}/${MARKET_RUN_STAGES.length} CLEARED`
                          : `已通过第 ${marketRunCompletedStages}/${MARKET_RUN_STAGES.length} 关`}
                    </small>
                    <b>
                      {marketRunFinished
                        ? locale === "en"
                          ? `Grade ${marketRunGrade(marketRunProgress.scores)}`
                          : `评级 ${marketRunGrade(marketRunProgress.scores)}`
                        : locale === "en"
                          ? `${marketRunScore} points banked`
                          : `已累计 ${marketRunScore} 分`}
                    </b>
                  </div>
                  <strong>{marketRunFinished ? marketRunGrade(marketRunProgress.scores) : skillScore}</strong>
                </header>
                <div className="market-run-scoreline">
                  {MARKET_RUN_STAGES.map((stage, index) => (
                    <span
                      key={stage.key}
                      className={index < marketRunCompletedStages ? "complete" : ""}
                    >
                      <i>{index + 1}</i>
                      <b>{marketRunProgress.scores[index] ?? "—"}</b>
                    </span>
                  ))}
                </div>
                <p>
                  {marketRunFinished
                    ? locale === "en"
                      ? `Five real charts · ${marketRunScore}/500 total · ${marketRunAverage} average. Start again to chase a cleaner run.`
                      : `五张真实行情 · 总分 ${marketRunScore}/500 · 平均 ${marketRunAverage}。再开一轮，挑战更稳定的判断。`
                    : locale === "en"
                      ? `Next: ${marketRunStage.title.en}. The difficulty rises, but your banked scores are safe.`
                      : `下一关：${marketRunStage.title.zh}。难度会提升，已获得的分数不会丢失。`}
                </p>
              </section>
            )}
            <div className="execution-cost-result">
              <div>
                <small>交易税费</small>
                <b>
                  {currencySymbol}
                  {nf.format(feesPaid)}
                </b>
              </div>
              <div>
                <small>模拟滑点损耗</small>
                <b>
                  {currencySymbol}
                  {nf.format(slippagePaid)}
                </b>
              </div>
              <p>
                <strong>成本已计入最终收益</strong>
                佣金和滑点均采用透明的训练假设
              </p>
            </div>
            <div className="result-analysis-grid">
            <section className="process-score-card">
              <div className="process-score-head">
                <div>
                  <small>PROCESS SCORE · 过程能力</small>
                    <b>收益只占 5%，优先奖励校准、风控与守计划</b>
                </div>
                <strong>{skillScore}</strong>
              </div>
              <div className="process-score-list">
                {(
                  [
                      ["风险控制", processScores.risk, "30%"],
                      ["概率校准", processScores.calibration, "30%"],
                      ["执行质量", processScores.execution, "10%"],
                      ["交易纪律", processScores.discipline, "25%"],
                      ["风险调整收益", processScores.performance, "5%"],
                  ] as const
                ).map(([label, value, weight]) => (
                  <div key={label}>
                    <span>{label}</span>
                    <i>
                      <em style={{ width: `${value}%` }} />
                    </i>
                    <b>
                        {label === "概率校准" && !decisionStats.total
                        ? "—"
                        : value.toFixed(0)}
                    </b>
                    <small>{weight}</small>
                  </div>
                ))}
              </div>
            </section>
            <div className="decision-result">
              <header>
                <small>DECISION QUALITY · 判断质量</small>
                <b>概率契约与结果校准</b>
              </header>
              <div>
                <small>方向判断</small>
                <b>
                  {decisionStats.total
                    ? `${decisionStats.hits}/${decisionStats.total}`
                    : "未记录"}
                </b>
              </div>
              <div>
                <small>命中率</small>
                <b>
                  {decisionStats.total
                    ? `${decisionStats.accuracy.toFixed(0)}%`
                    : "—"}
                </b>
              </div>
              <div>
                  <small>平均校准</small>
                <b>
                  {decisionStats.total
                    ? decisionStats.calibration.toFixed(0)
                    : "—"}
                </b>
              </div>
              <p>
                {!decisionStats.total
                  ? "这是旧版记录，缺少概率契约；交易执行与风险画像仍正常分析。"
                  : decisionStats.confidentMisses
                  ? `有 ${decisionStats.confidentMisses} 次高信心误判；下局先降低仓位，再等待走势确认。`
                  : "每次推进的概率都会与真实后续逐笔对照；观望与买卖接受同一套校准检验。"}
              </p>
            </div>
            </div>
            {gameMode === "daily" && crowdComparison.rounds > 0 && (
              <section className="crowd-result-card">
                <header>
                  <div>
                    <small>YOU VS THE CROWD · 全球判断对照</small>
                    <b>
                      {locale === "en"
                        ? `Compared across ${crowdComparison.rounds} decisions`
                        : `已对照 ${crowdComparison.rounds} 次有效判断`}
                    </b>
                  </div>
                  <span>
                    {locale === "en" ? "UP TO" : "最多"}{" "}
                    {crowdComparison.largestSample.toLocaleString(numberLocale)}{" "}
                    {locale === "en" ? "READS" : "份判断"}
                  </span>
                </header>
                <div className="crowd-result-metrics">
                  <div>
                    <small>{locale === "en" ? "WITH CROWD" : "顺着人群"}</small>
                    <b>{crowdComparison.agreements}/{crowdComparison.rounds}</b>
                  </div>
                  <div>
                    <small>{locale === "en" ? "CONTRARIAN" : "逆向判断"}</small>
                    <b>{crowdComparison.contrarianCalls}</b>
                  </div>
                  <div className={crowdComparison.beatCrowd ? "edge" : ""}>
                    <small>{locale === "en" ? "BEAT CROWD" : "领先人群"}</small>
                    <b>{crowdComparison.beatCrowd}</b>
                  </div>
                </div>
                <p>
                  {locale === "en"
                    ? crowdComparison.beatCrowd
                      ? `You were right ${crowdComparison.beatCrowd} ${crowdComparison.beatCrowd === 1 ? "time" : "times"} when the crowd's top view was wrong. That is evidence—not permission to size up the next trade.`
                      : crowdComparison.contrarianCalls
                        ? `You went against the crowd ${crowdComparison.contrarianCalls} ${crowdComparison.contrarianCalls === 1 ? "time" : "times"}. ${crowdComparison.contrarianWins} of those calls was right; compare the evidence before repeating it.`
                        : "Your views matched the crowd this round. Agreement can be useful, but it is not proof that the crowd is right."
                    : crowdComparison.beatCrowd
                      ? `当人群最高概率判断错误时，你有 ${crowdComparison.beatCrowd} 次判断正确。这是可复盘的证据，不代表下一次应该放大仓位。`
                      : crowdComparison.contrarianCalls
                        ? `你有 ${crowdComparison.contrarianCalls} 次逆向判断，其中 ${crowdComparison.contrarianWins} 次命中；下次应先比较依据，再决定是否重复。`
                        : "本局判断与人群主流一致。一致可以提供参考，但不代表人群一定正确。"}
                </p>
              </section>
            )}
            <section className="decision-replay">
              <div className="decision-replay-head">
                <div>
                  <small>DECISION REPLAY · 决策时间线</small>
                  <b>每次推进都留下可检验的决策证据</b>
                </div>
                <span>
                  {decisionReplay.length} 次推进 · {decisionStats.total} 份契约
                </span>
              </div>
              {decisionReplay.length ? (
                <div className="decision-timeline">
                  {decisionReplay.slice(0, replayLimit).map((item) => (
                    <article
                      key={item.round}
                      className={
                        item.matched == null
                          ? "unrated"
                          : item.matched
                            ? "matched"
                            : "missed"
                      }
                    >
                      <i>{item.round}</i>
                      <div>
                        <small>{item.date} · 推进 {item.days} 日</small>
                        <b>{item.action} · {item.order}</b>
                        <p>
                          {item.matched == null
                            ? "未记录方向观点 · 本次不参与判断评分"
                            : `${item.thesis} · ${item.probabilities ? formatProbabilityForecast(item.probabilities, locale) : `判断${OUTLOOK_LABEL[item.outlook!]} · 信心 ${item.confidence}/3`}`}
                        </p>
                        {crowdByRound.get(item.round)?.sampleSize &&
                          crowdByRound.get(item.round)!.sampleSize >= 2 &&
                          crowdLeader(crowdByRound.get(item.round)!) && (
                            <p className="crowd-replay-note">
                              {locale === "en" ? "Crowd" : "全球共识"}: {locale === "en"
                                ? crowdLeader(crowdByRound.get(item.round)!)!.toUpperCase()
                                : OUTLOOK_LABEL[crowdLeader(crowdByRound.get(item.round)!)!]}
                              {" "}
                              {crowdByRound.get(item.round)![
                                crowdLeader(crowdByRound.get(item.round)!)!
                              ]}% · n={crowdByRound.get(item.round)!.sampleSize}
                            </p>
                          )}
                      </div>
                      <strong>
                        {item.matched == null
                          ? "未评分"
                          : item.matched
                            ? "命中"
                            : "偏差"}
                        <small className={item.move >= 0 ? "up" : "down"}>
                          后续{OUTLOOK_LABEL[item.actual]} {item.move >= 0 ? "+" : ""}{item.move.toFixed(2)}%
                        </small>
                      </strong>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="decision-replay-empty">本局尚未产生可复盘的推进记录。</p>
              )}
              {replayLimit < decisionReplay.length && (
                <button
                  className="replay-more"
                  onClick={() => setReplayLimit((value) => value + 20)}
                >
                  继续查看后续 {Math.min(20, decisionReplay.length - replayLimit)} 次决策
                </button>
              )}
            </section>
            {activeScenario && !isMarketRun && scenarioEvaluation && (
              <section
                className={`scenario-settlement ${scenarioEvaluation.passed ? "passed" : "retry"}`}
              >
                <div className="scenario-settlement-head">
                  <span>
                    {scenarioEvaluation.passed ? "训练通关" : "训练未通关"}
                  </span>
                  <b>
                    {activeScenario.title} · {activeDifficulty.label}
                  </b>
                  <strong>{scenarioEvaluation.completed}/4</strong>
                </div>
                <div className="scenario-checks">
                  {scenarioEvaluation.checks.map((check) => (
                    <div
                      key={check.label}
                      className={check.passed ? "done" : "miss"}
                    >
                      <i>{check.passed ? "✓" : "×"}</i>
                      <span>{check.label}</span>
                      <b>{check.value}</b>
                    </div>
                  ))}
                </div>
                <p>
                  <b>情景复盘：</b>
                  {activeScenario.debrief}
                </p>
                <button
                  disabled={challengeLoading}
                  onClick={() =>
                    void resetGame(
                      "practice",
                      market,
                      session.scenario,
                      session.difficulty,
                    )
                  }
                >
                  {challengeLoading ? "正在重新筛选…" : "再练一次同类情景"}
                </button>
              </section>
            )}
            {gameMode === "daily" && (
              <div className="rank-result">
                {scoreStatus === "loading" ? (
                  <p>正在由服务器复算决策路径并生成排名…</p>
                ) : scoreStatus === "error" ? (
                  <button onClick={() => setScoreStatus("idle")}>
                    成绩提交失败，点击重试
                  </button>
                ) : scoreboard?.playerScore ? (
                  <>
                    <div>
                      <small>
                        {historicalDuel
                          ? locale === "en"
                            ? `${market === "us" ? "US stock" : "China A-share"} archived friend duel`
                            : `${marketLabel}历史好友对决`
                          : `${marketLabel}今日首次成绩`}
                      </small>
                      <b>
                        {historicalDuel
                          ? locale === "en"
                            ? `Room rank #${scoreboard.playerScore.rank}`
                            : `房间第 ${scoreboard.playerScore.rank} 名`
                          : `第 ${scoreboard.playerScore.rank} 名`}
                      </b>
                      <span>
                        {historicalDuel
                          ? locale === "en"
                            ? `First attempt locked · ${scoreboard.duelRoom?.responseCount ?? 0} completed`
                            : `首次成绩已锁定 · ${scoreboard.duelRoom?.responseCount ?? 0} 人完成`
                          : `超过 ${scoreboard.playerScore.percentile}% 玩家 · 共 ${scoreboard.total} 人`}
                      </span>
                    </div>
                    {activeDuel && (
                      <>
                        <div className="duel-result">
                          <small>
                            {scoreboard.duelRoom?.isHost
                              ? locale === "en"
                                ? `YOUR DUEL ROOM · ${scoreboard.duelRoom.responseCount} COMPLETED`
                                : `你的好友擂台 · ${scoreboard.duelRoom.responseCount} 人已完成`
                              : locale === "en"
                                ? "FRIEND DUEL"
                                : "好友对决"}
                          </small>
                          {scoreboard.opponent ? (
                          <b
                            className={
                              scoreboard.playerScore.score >=
                              scoreboard.opponent.score
                                ? "win"
                                : "lose"
                            }
                          >
                            {scoreboard.playerScore.score} :{" "}
                            {scoreboard.opponent.score}
                            <em>
                              {scoreboard.playerScore.score >=
                              scoreboard.opponent.score
                                ? "你领先"
                                : "好友领先"}
                            </em>
                          </b>
                          ) : (
                            <span>
                              {locale === "en"
                                ? "No replies yet—share the room again"
                                : "还没有好友完成，可以继续分享擂台"}
                            </span>
                          )}
                        </div>
                        {scoreboard.opponent && (
                          <div className="duel-comparison">
                            <article className="me">
                              <small>你的决策</small>
                              <b>{scoreboard.playerScore.score}</b>
                              <span>
                                收益 {scoreboard.playerScore.returnRate >= 0 ? "+" : ""}
                                {scoreboard.playerScore.returnRate.toFixed(1)}% · 回撤{" "}
                                {(scoreboard.playerScore.maxDrawdown ?? 0).toFixed(1)}%
                              </span>
                            </article>
                            <article>
                              <small>{scoreboard.opponent.nickname}</small>
                              <b>{scoreboard.opponent.score}</b>
                              <span>
                                收益 {scoreboard.opponent.returnRate >= 0 ? "+" : ""}
                                {scoreboard.opponent.returnRate.toFixed(1)}% · 回撤{" "}
                                {(scoreboard.opponent.maxDrawdown ?? 0).toFixed(1)}%
                              </span>
                            </article>
                          </div>
                        )}
                      </>
                    )}
                  </>
                ) : (
                  <p>完成校验后显示今日排名</p>
                )}
              </div>
            )}
            {gameMode === "daily" && scoreStatus === "done" && initialCrewCode && (
              <section className={`crew-result-loop ${crewResult?.allDoneToday ? "complete" : "waiting"}`}>
                <span className="crew-result-flame" aria-hidden="true">🔥</span>
                <div>
                  <small>{crewResult?.allDoneToday ? "CREW FLAME EXTENDED" : "CREW CHECK-IN RECORDED"}</small>
                  <b>
                    {crewResult
                      ? crewResult.allDoneToday
                        ? locale === "en"
                          ? `Everyone showed up · ${crewResult.currentStreak}-day Crew Streak`
                          : `全员到齐 · 小队连续 ${crewResult.currentStreak} 天`
                        : locale === "en"
                          ? `${crewResult.completedToday}/${crewResult.memberCount} checked in today`
                          : `今天已有 ${crewResult.completedToday}/${crewResult.memberCount} 人完成`
                      : locale === "en"
                        ? "Your daily finish now counts for the crew"
                        : "今日完成已计入小队"}
                  </b>
                  <p>
                    {crewResult?.allDoneToday
                      ? locale === "en"
                        ? "The shared commitment is complete. See the flame you extended together."
                        : "共同约定已经完成，去看看你们一起延续的火焰。"
                      : locale === "en"
                        ? "Your part is done. Return to the crew to see who is still on the way."
                        : "你已经完成自己的部分，返回小队查看还有谁正在赶来。"}
                  </p>
                </div>
                <Link
                  href={`/c/${initialCrewCode}`}
                  onClick={() => {
                    if (playerId) trackActivationEvent(playerId, "crew_result_return", "crew");
                  }}
                >
                  {crewResult?.allDoneToday
                    ? locale === "en" ? "See the crew flame →" : "查看共同火焰 →"
                    : locale === "en" ? "Return to my crew →" : "返回我的小队 →"}
                </Link>
              </section>
            )}
            {gameMode === "daily" ? (
              <div className="profile-card decision-style-card">
                <i aria-hidden="true">{decisionStyle.badge}</i>
                <div>
                  <small>
                    {locale === "en"
                      ? "TODAY'S DECISION STYLE"
                      : "今日决策风格"}
                  </small>
                  <b>{decisionStyle.title}</b>
                  <p>{decisionStyle.description}</p>
                  <em>{decisionStyle.nextGoal}</em>
                </div>
              </div>
            ) : (
              <div className="profile-card">
                <small>本局交易画像</small>
                <b>{profile.title}</b>
                <p>{profile.text}</p>
              </div>
            )}
            <button
              className="analysis-action"
              onClick={() => setAnalysisOpen(true)}
            >
              <span>
                <small>个性化交易复盘</small>
                <b>深度分析我的画像</b>
              </span>
              <i>查看仓位、风险、择时与训练建议 →</i>
            </button>
            {!isMarketRun && (
              <button
                className="next-training-card"
                disabled={challengeLoading}
                onPointerEnter={() =>
                  prefetchChallenge(
                    "practice",
                    market,
                    weakestSkill.scenario,
                    "standard",
                  )
                }
                onFocus={() =>
                  prefetchChallenge(
                    "practice",
                    market,
                    weakestSkill.scenario,
                    "standard",
                  )
                }
                onClick={() =>
                  void resetGame(
                    "practice",
                    market,
                    weakestSkill.scenario,
                    "standard",
                  )
                }
              >
                <span>
                  <small>系统推荐下一局</small>
                  <b>强化{weakestSkill.label}</b>
                </span>
                <i>
                  {challengeLoading
                    ? "正在匹配训练…"
                    : `${SCENARIO_CONFIG[weakestSkill.scenario].title} · 标准 →`}
                </i>
              </button>
            )}
            {gameMode === "daily" && (
              <section className="daily-return-loop">
                <div className="daily-return-copy">
                  <small>
                    {locale === "en" ? "NEXT DAILY MYSTERY" : "下一张每日神秘图"} · {marketResetLabel}
                  </small>
                  <b>{dailyCountdown}</b>
                  <p>
                    {locale === "en"
                      ? completedDailyChallenges <= 1
                        ? "Day one is locked. Come back for a new real chart and start building your read."
                        : `You have completed ${completedDailyChallenges} daily challenges. Keep the evidence growing tomorrow.`
                      : completedDailyChallenges <= 1
                        ? "首日记录已锁定。明天回来挑战新的真实行情，建立你的判断样本。"
                        : `已完成 ${completedDailyChallenges} 次每日挑战，明天继续积累判断证据。`}
                  </p>
                </div>
                <div className="streak-week" aria-label={
                  locale === "en"
                    ? `${currentStreak}-day streak, seven-day target`
                    : `当前连续 ${currentStreak} 天，目标七天`
                }>
                  <header>
                    <span>{locale === "en" ? "7-DAY TARGET" : "七日目标"}</span>
                    <b>🔥 {currentStreak}</b>
                  </header>
                  <div aria-hidden="true">
                    {Array.from({ length: 7 }, (_, index) => (
                      <i
                        key={index}
                        className={
                          index >= 7 - Math.min(7, currentStreak)
                            ? "complete"
                            : ""
                        }
                      />
                    ))}
                  </div>
                  <footer
                    className={
                      streakProtection.freezeEarnedToday ||
                      streakProtection.freezeUsedToday
                        ? "highlight"
                        : ""
                    }
                  >
                    <span>
                      {streakProtection.freezeUsedToday
                        ? locale === "en"
                          ? "STREAK SAVED"
                          : "连续记录已保住"
                        : streakProtection.freezeEarnedToday
                          ? locale === "en"
                            ? "FREEZE EARNED"
                            : "获得一次保护"
                          : locale === "en"
                            ? "STREAK FREEZE"
                            : "连续挑战保护"}
                    </span>
                    <b>{streakProtection.availableFreezes}/2</b>
                    <small>
                      {streakProtection.freezeUsedToday
                        ? locale === "en"
                          ? "A missed day was covered automatically."
                          : "已自动覆盖一次漏玩日期。"
                        : streakProtection.freezeEarnedToday
                          ? locale === "en"
                            ? "One missed day is now covered automatically."
                            : "之后漏玩一天时将自动保护连续记录。"
                          : streakProtection.availableFreezes >= 2
                            ? locale === "en"
                              ? "Protection full"
                              : "保护已满"
                            : locale === "en"
                              ? `Next in ${streakProtection.nextFreezeIn} daily challenges`
                              : `再完成 ${streakProtection.nextFreezeIn} 次获得`}
                    </small>
                  </footer>
                </div>
              </section>
            )}
            {gameMode === "daily" &&
              scoreStatus === "done" &&
              installPrompt && (
                <section className="install-return-card">
                  <span className="install-app-mark" aria-hidden="true">
                    K
                  </span>
                  <div>
                    <small>
                      {locale === "en"
                        ? "KEEP YOUR STREAK CLOSE"
                        : "把连续挑战放在手边"}
                    </small>
                    <b>
                      {locale === "en"
                        ? "Install Blind Trading"
                        : "安装盲盘挑战"}
                    </b>
                    <p>
                      {locale === "en"
                        ? "Open tomorrow’s mystery from your home screen—no app store, no extra account."
                        : "明天从主屏幕直接打开新谜题，无需应用商店，也无需额外账号。"}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={installStatus.includes("…")}
                    onClick={() => void installGame()}
                  >
                    {installStatus ||
                      (locale === "en" ? "Add to home screen" : "添加到主屏幕")}
                  </button>
                </section>
              )}
            <div className="date-reveal">
              本局走到：{stock.candles[initialVisibleCount - 1].date} —{" "}
              {stock.candles[visibleCount - 1].date} · 完整数据：
              {stock.candles[0].date} — {stock.candles.at(-1)?.date}（
              {stock.candles.length.toLocaleString(numberLocale)} 根）· 共 {trades}{" "}
              次交易 · 成本 {currencySymbol}
              {nf.format(feesPaid + slippagePaid)}
            </div>
            {(gameMode === "daily" || isEndlessMode) && scoreStatus === "done" && (
              <section className="result-share-kit">
                <div>
                  <small>
                    {isEndlessMode
                      ? locale === "en"
                        ? "SHARE YOUR LONG CYCLE"
                        : "分享你的长周期"
                      : locale === "en"
                        ? "SHARE WITHOUT SPOILERS"
                        : "无剧透分享"}
                  </small>
                  {resultComparisonProof && (
                    <em className="result-comparison-proof">
                      {resultComparisonProof}
                    </em>
                  )}
                  <b>
                    {isEndlessMode
                      ? locale === "en"
                        ? `${decisionStyle.title} · your Endless read`
                        : `${decisionStyle.title} · 你的无尽长周期判断`
                      : locale === "en"
                        ? `${decisionStyle.title} · your five-decision challenge`
                        : `${decisionStyle.title} · 你的五次决策轨迹`}
                  </b>
                  <span
                    className="share-mark-preview"
                    aria-label={
                      locale === "en"
                        ? "Five-decision calibration preview"
                        : "五次决策校准预览"
                    }
                  >
                    {Array.from(
                      { length: DAILY_CHALLENGE_DECISIONS },
                      (_, index) => {
                        const value = resultShareMarks[index] ?? 50;
                        return (
                          <i
                            key={index}
                            className={
                              value >= 70
                                ? "good"
                                : value >= 45
                                  ? "mixed"
                                  : "miss"
                            }
                          />
                        );
                      },
                    )}
                  </span>
                  <p>
                    {locale === "en"
                        ? isEndlessMode
                          ? "Shows your style, score, and a scan-to-play QR—not the ticker or the answer."
                          : "Shows your style, score, and a scan-to-challenge QR—not the ticker or the answer."
                        : isEndlessMode
                          ? "展示风格、得分和可扫码继续游玩的二维码，不泄露股票名或答案。"
                          : "展示风格、得分和可扫码挑战的二维码，不泄露股票名或答案。"}
                  </p>
                  <div
                    className="result-card-picker"
                    role="group"
                    aria-label={
                      locale === "en" ? "Choose share card" : "选择分享卡片"
                    }
                  >
                    <button
                      type="button"
                      className={resultCardVariant === "style" ? "active" : ""}
                      aria-pressed={resultCardVariant === "style"}
                      onClick={() => {
                        setResultCardVariant("style");
                        setCardStatus("");
                      }}
                    >
                      <b>{locale === "en" ? "Style card" : "风格卡"}</b>
                      <small>{locale === "en" ? "Identity first" : "身份优先"}</small>
                    </button>
                    <button
                      type="button"
                      className={resultCardVariant === "score" ? "active" : ""}
                      aria-pressed={resultCardVariant === "score"}
                      onClick={() => {
                        setResultCardVariant("score");
                        setCardStatus("");
                      }}
                    >
                      <b>{locale === "en" ? "Score card" : "成绩卡"}</b>
                      <small>{locale === "en" ? "Stats first" : "数据优先"}</small>
                    </button>
                  </div>
                </div>
                <div className="result-card-actions">
                  <button
                    type="button"
                    disabled={cardStatus.includes("…")}
                    onClick={() => void shareResultCard()}
                  >
                    {cardStatus ||
                      (locale === "en"
                        ? `Share ${resultCardVariant} card`
                        : `分享${resultCardVariant === "style" ? "风格" : "成绩"}卡`)}
                  </button>
                  <button
                    type="button"
                    disabled={cardStatus.includes("…")}
                    onClick={() => void saveResultCard()}
                  >
                    {locale === "en"
                      ? `Save ${resultCardVariant} image`
                      : `保存${resultCardVariant === "style" ? "风格" : "成绩"}图`}
                  </button>
                </div>
                <nav
                  className="result-share-channels"
                  aria-label={
                    locale === "en" ? "Share challenge directly" : "直接分享挑战"
                  }
                >
                  <span>
                    {shareSetupStatus === "loading"
                      ? locale === "en"
                        ? "Preparing your spoiler-free challenge…"
                        : "正在准备无剧透挑战链接…"
                      : shareSetupStatus === "error"
                        ? locale === "en"
                          ? "Challenge link needs a retry below"
                          : "挑战链接需要在下方重试"
                        : activeDuel && scoreboard?.shareDuel
                          ? locale === "en"
                            ? `Your score challenge is ready · Round ${scoreboard.shareDuel.chainDepth + 1}`
                            : `你的成绩挑战已就绪 · 第 ${scoreboard.shareDuel.chainDepth + 1} 轮`
                          : locale === "en"
                            ? "Send directly"
                            : "直接发送"}
                  </span>
                  <div>
                    <a
                      href={resultChannelHref("x")}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-disabled={!duelShareUrl}
                      onClick={() => duelShareUrl && recordDuelShare("x")}
                    >
                      X
                    </a>
                    <a
                      href={resultChannelHref("whatsapp")}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-disabled={!duelShareUrl}
                      onClick={() =>
                        duelShareUrl && recordDuelShare("whatsapp")
                      }
                    >
                      WhatsApp
                    </a>
                    <a
                      href={resultChannelHref("telegram")}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-disabled={!duelShareUrl}
                      onClick={() =>
                        duelShareUrl && recordDuelShare("telegram")
                      }
                    >
                      Telegram
                    </a>
                    <a
                      href={resultChannelHref("reddit")}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-disabled={!duelShareUrl}
                      onClick={() => duelShareUrl && recordDuelShare("reddit")}
                    >
                      Reddit
                    </a>
                    <a
                      href={resultChannelHref("bluesky")}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-disabled={!duelShareUrl}
                      onClick={() =>
                        duelShareUrl && recordDuelShare("bluesky")
                      }
                    >
                      Bluesky
                    </a>
                    <button
                      type="button"
                      disabled={!duelShareUrl}
                      onClick={() => void shareResult("copy")}
                    >
                      {locale === "en" ? "Copy link" : "复制链接"}
                    </button>
                  </div>
                </nav>
              </section>
            )}
            {isMarketRun ? (
              <div className="result-actions three market-run-actions">
                <button
                  className="primary-action"
                  disabled={challengeLoading}
                  onClick={() => void continueMarketRun()}
                >
                  {challengeLoading
                    ? locale === "en"
                      ? "Loading next market…"
                      : "正在载入下一关…"
                    : marketRunFinished
                      ? locale === "en"
                        ? "Start a new run →"
                        : "再开一轮 →"
                      : locale === "en"
                        ? `Next market · ${marketRunStage.title.en} →`
                        : `下一关 · ${marketRunStage.title.zh} →`}
                </button>
                <Link className="hold-action result-mode-link" href="/">
                  {locale === "en" ? "Exit to modes" : "返回玩法大厅"}
                </Link>
                <button
                  className="review-action"
                  onClick={() => setResultOpen(false)}
                >
                  {locale === "en" ? "Review this chart" : "复盘本关 K 线"}
                </button>
              </div>
            ) : (
              <div className="result-actions three">
                <button
                  className="primary-action"
                  disabled={gameMode === "daily" && scoreStatus !== "done"}
                  onClick={() => void shareResult("native")}
                >
                  {shareStatus ||
                    (gameMode === "daily"
                      ? scoreStatus === "done"
                        ? activeDuel && scoreboard?.duelRoom?.isHost
                          ? locale === "en"
                            ? `Share duel room · ${scoreboard.duelRoom.responseCount} completed`
                            : `继续分享擂台 · ${scoreboard.duelRoom.responseCount} 人已完成`
                          : activeDuel && scoreboard?.opponent
                            ? locale === "en"
                              ? `Challenge friends to beat my ${scoreboard.playerScore?.score ?? skillScore}`
                              : `让好友挑战我的 ${scoreboard.playerScore?.score ?? skillScore} 分`
                            : "发起好友同图挑战"
                        : "正在准备挑战卡…"
                      : "分享战绩")}
                </button>
                <Link
                  className="hold-action result-mode-link"
                  href={`/${gameMode === "daily" ? "run" : isEndlessMode ? "endless" : "daily"}?market=${market}`}
                >
                  {gameMode === "daily"
                    ? locale === "en"
                      ? "Start a Market Run"
                      : "开始市场闯关"
                    : isEndlessMode
                    ? locale === "en"
                      ? "Start another long cycle"
                      : "再来一段长周期"
                    : locale === "en"
                      ? "Go to Daily Challenge"
                      : "前往每日挑战"}
                </Link>
                <button
                  className="review-action"
                  onClick={() => setResultOpen(false)}
                >
                  返回复盘 K 线
                </button>
              </div>
            )}
          </section>
        </div>
      )}

      {analysisOpen && (
        <dialog
          open
          className="modal-backdrop analysis-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setAnalysisOpen(false);
          }}
        >
          <section className="analysis-modal">
            <button
              className="modal-close"
              onClick={() => setAnalysisOpen(false)}
            >
              ×
            </button>
            <small className="eyebrow">MY TRADING DNA · 本局深度复盘</small>
            <div className="analysis-hero">
              <span>你的交易画像</span>
              <h2>{deepProfile.title}</h2>
              <p>{deepProfile.summary}</p>
              <small>{deepProfile.confidence}</small>
            </div>
            <div className="analysis-metrics">
              {deepProfile.metrics.map((metric) => (
                <div key={metric.label}>
                  <small>{metric.label}</small>
                  <b>{metric.value}</b>
                  <span>{metric.note}</span>
                </div>
              ))}
            </div>
            <div className="analysis-section-head">
              <b>四维诊断</b>
              <span>基于本局逐日净值与真实成交点</span>
            </div>
            <div className="analysis-dimensions">
              {deepProfile.dimensions.map((dimension) => (
                <article key={dimension.label} className={dimension.tone}>
                  <div>
                    <span>{dimension.label}</span>
                    <b>{dimension.grade}</b>
                  </div>
                  <p>{dimension.text}</p>
                </article>
              ))}
            </div>
            <div className="analysis-section-head">
              <b>概率校准</b>
              <span>涨 / 震荡 / 跌概率 × 后续真实走势</span>
            </div>
            <div className="calibration-card">
              <strong>
                {decisionStats.total
                  ? decisionStats.calibration.toFixed(0)
                  : "—"}
              </strong>
              <div>
                <b>
                  {decisionStats.total
                    ? `${decisionStats.hits} / ${decisionStats.total} 次方向命中`
                    : "旧版记录缺少概率契约"}
                </b>
                <p>
                  {!decisionStats.total
                    ? "旧版记录仍保留交易、持有和风险画像，但不纳入概率校准。"
                    : decisionStats.total < 4
                    ? "样本仍少，继续记录判断后才能形成稳定画像。"
                    : decisionStats.calibration >= 70
                      ? "方向与信心匹配良好，继续避免因为连续命中而突然放大仓位。"
                      : "高信心并没有稳定转化成命中，建议把‘预测’和‘下单仓位’分开管理。"}
                </p>
              </div>
            </div>
            {feedbackHistory.length > 0 && (
              <>
                <div className="analysis-section-head">
                  <b>逐次决策证据</b>
                  <span>不是只看最终盈亏</span>
                </div>
                <div className="feedback-history">
                  {feedbackHistory.map((feedback) => (
                    <article
                      key={feedback.round}
                      className={feedback.matched ? "hit" : "miss"}
                    >
                      <i>{feedback.matched ? "✓" : "!"}</i>
                      <div>
                        <small>第 {feedback.round} 次</small>
                        <b>{feedback.title}</b>
                        <p>{feedback.lesson}</p>
                      </div>
                      <span>
                        MFE +{feedback.favorable.toFixed(1)}% · MAE{" "}
                        {feedback.adverse.toFixed(1)}%
                      </span>
                    </article>
                  ))}
                </div>
              </>
            )}
            <div className="analysis-section-head">
              <b>带走的 3 条经验</b>
              <span>下一局可以直接执行</span>
            </div>
            <ol className="analysis-lessons">
              {deepProfile.lessons.map((lesson, index) => (
                <li key={lesson}>
                  <i>0{index + 1}</i>
                  <span>{lesson}</span>
                </li>
              ))}
            </ol>
            <div className="training-goal">
              <small>NEXT SESSION GOAL</small>
              <b>{deepProfile.trainingGoal}</b>
            </div>
            <p className="analysis-disclaimer">
              画像只反映本局历史样本，用于训练决策与复盘，不构成投资建议。
            </p>
            <button
              className="primary-action"
              onClick={() => setAnalysisOpen(false)}
            >
              返回结算
            </button>
          </section>
        </dialog>
      )}
    </main>
    </Localized>
  );
}
