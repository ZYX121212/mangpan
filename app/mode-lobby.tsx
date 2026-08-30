"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { trackActivationEvent } from "./activation-events";
import type { Locale } from "./i18n";
import type { MarketKind } from "./game-config";

const ONBOARDING_STORAGE_KEY = "mangpan-guided-first-chart-v1";

function ensureLocalPlayerId() {
  const existing = localStorage.getItem("mangpan-player-id");
  if (existing) return existing;
  const created = crypto.randomUUID();
  localStorage.setItem("mangpan-player-id", created);
  return created;
}

const MODES = [
  {
    number: "01",
    href: "/daily",
    eyebrow: { en: "ONE SHARED PUZZLE", zh: "全球同题" },
    title: { en: "Daily Challenge", zh: "每日挑战" },
    description: {
      en: "The same hidden chart for everyone. Five decisions, one verified score, one fresh puzzle each market day.",
      zh: "所有玩家面对同一张隐藏行情；五次决策、一个可信分数，每个市场日更新一题。",
    },
    meta: { en: "Ranked · about 90 sec", zh: "计入排名 · 约 90 秒" },
    action: { en: "Play today’s chart", zh: "挑战今日题目" },
    tone: "daily",
  },
  {
    number: "02",
    href: "/practice",
    eyebrow: { en: "NO PRESSURE", zh: "自由探索" },
    title: { en: "Endless Practice", zh: "无限练习" },
    description: {
      en: "Read random real charts at your own pace. Change stocks, test ideas, and stop whenever you want.",
      zh: "按自己的节奏探索随机真实行情；随时换股、验证想法，不影响每日排名。",
    },
    meta: { en: "Unlimited · unranked", zh: "不限次数 · 不排名" },
    action: { en: "Start practicing", zh: "进入自由练习" },
    tone: "practice",
  },
  {
    number: "03",
    href: "/training",
    eyebrow: { en: "BUILD ONE SKILL", zh: "专项提升" },
    title: { en: "Training Lab", zh: "训练学院" },
    description: {
      en: "Choose a lesson for trends, reversals, crashes, or volatile markets, then get a focused debrief.",
      zh: "针对趋势、拐点、急跌或高波动选择课程，完成后获得专项复盘。",
    },
    meta: { en: "12 lessons · adaptive review", zh: "12 课 · 错因重练" },
    action: { en: "Choose a lesson", zh: "选择训练课程" },
    tone: "training",
  },
  {
    number: "04",
    href: "/duel",
    eyebrow: { en: "SAME CHART, TWO READS", zh: "同图对决" },
    title: { en: "Friend Duel", zh: "好友对决" },
    description: {
      en: "Enter an invite code or open a friend’s link. Both players get the exact same hidden market setup.",
      zh: "输入挑战码或打开好友链接；双方获得完全相同的隐藏历史行情。",
    },
    meta: { en: "Verified · spoiler-free", zh: "服务器复算 · 不剧透" },
    action: { en: "Enter a duel", zh: "进入好友对决" },
    tone: "duel",
  },
  {
    number: "05",
    href: "/crew",
    eyebrow: { en: "KEEP THE FLAME ALIVE", zh: "共同连续" },
    title: { en: "Crew Streak", zh: "小队连续挑战" },
    description: {
      en: "Create a private crew for up to five friends. The shared streak grows only when every member finishes today’s chart.",
      zh: "创建最多五人的私密小队；只有每位成员都完成今日盲盘，共同连续纪录才会增长。",
    },
    meta: { en: "2–5 friends · daily", zh: "2–5 人 · 每日共同完成" },
    action: { en: "Open crew streaks", zh: "进入小队模式" },
    tone: "crew",
  },
] as const;

export default function ModeLobby() {
  const [locale, setLocale] = useState<Locale>("en");
  const [market, setMarket] = useState<MarketKind>("us");
  const [playerId, setPlayerId] = useState("");
  const [isNewPlayer, setIsNewPlayer] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const savedLocale = localStorage.getItem("mangpan-locale");
      const savedMarket = localStorage.getItem("mangpan-market");
      const id = ensureLocalPlayerId();
      const hasPriorActivity = Boolean(
        localStorage.getItem(ONBOARDING_STORAGE_KEY) === "complete" ||
        localStorage.getItem("mangpan-active-session-us") ||
        localStorage.getItem("mangpan-active-session-cn") ||
        localStorage.getItem("mangpan-scenario-progress") ||
        localStorage.getItem("mangpan-player-name"),
      );
      if (savedLocale === "zh") setLocale("zh");
      if (savedMarket === "cn") setMarket("cn");
      setPlayerId(id);
      setIsNewPlayer(!hasPriorActivity);
      trackActivationEvent(id, "lobby_view", "lobby");
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const chooseLocale = (next: Locale) => {
    setLocale(next);
    localStorage.setItem("mangpan-locale", next);
    document.documentElement.lang = next === "zh" ? "zh-CN" : "en";
  };
  const chooseMarket = (next: MarketKind) => {
    setMarket(next);
    localStorage.setItem("mangpan-market", next);
  };
  const startFirstChart = () => {
    trackActivationEvent(playerId || ensureLocalPlayerId(), "guide_start", "lobby");
  };

  return (
    <main className="mode-lobby-page">
      <header className="mode-lobby-topbar">
        <Link className="mode-lobby-brand" href="/">
          <span>B</span>
          <b>BLIND TRADING</b>
        </Link>
        <div className="mode-lobby-controls">
          <div className="lobby-market-switch" role="group" aria-label="Market">
            <button
              className={market === "us" ? "active" : ""}
              onClick={() => chooseMarket("us")}
            >
              US
            </button>
            <button
              className={market === "cn" ? "active" : ""}
              onClick={() => chooseMarket("cn")}
            >
              A-SHARES
            </button>
          </div>
          <button
            className="lobby-locale-switch"
            onClick={() => chooseLocale(locale === "en" ? "zh" : "en")}
          >
            {locale === "en" ? "中文" : "EN"}
          </button>
        </div>
      </header>

      <section className={`mode-lobby-hero ${isNewPlayer ? "first-play" : ""}`}>
        <small>
          {isNewPlayer
            ? "ONE REAL CHART · NO SIGN-UP"
            : "BLIND TRADING · FIVE WAYS TO PLAY"}
        </small>
        <h1>
          {isNewPlayer
            ? locale === "en"
              ? "Can you read what happens next?"
              : "你能读懂接下来会发生什么吗？"
            : locale === "en"
              ? "Choose one goal. Enter one focused game."
              : "一次只做一件事，进入一种清晰玩法。"}
        </h1>
        <p>
          {isNewPlayer
            ? locale === "en"
              ? "Make one forecast on a hidden piece of real market history, then reveal the answer. Learn the complete loop by playing—not by reading a tutorial."
              : "在一段隐藏身份的真实历史行情上做一次判断，再揭晓答案。先玩懂核心循环，不用先读教程。"
            : locale === "en"
              ? "Daily competition, free exploration, deliberate training, friend duels, and crew streaks live in separate modes—with their own rules and rhythm."
              : "每日竞技、自由探索、专项训练、好友对决和小队连续挑战各自独立，不再把不同目标堆进同一局。"}
        </p>
        {isNewPlayer && (
          <div className="first-play-actions">
            <Link
              href={`/practice?market=${market}&guide=1`}
              onClick={startFirstChart}
            >
              <span>{locale === "en" ? "Play one chart" : "先玩一张"}</span>
              <small>{locale === "en" ? "Guided · about 60 sec" : "有引导 · 约 60 秒"}</small>
              <b>→</b>
            </Link>
            <button
              type="button"
              onClick={() =>
                document.getElementById("game-modes")?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                })
              }
            >
              {locale === "en" ? "I know the game · browse modes" : "我已经会玩 · 浏览模式"}
            </button>
          </div>
        )}
      </section>

      <section id="game-modes" className="mode-lobby-grid" aria-label="Game modes">
        {MODES.map((mode) => (
          <Link
            className={`mode-lobby-card ${mode.tone}`}
            href={`${mode.href}?market=${market}`}
            key={mode.href}
          >
            <header>
              <span>{mode.number}</span>
              <small>{mode.eyebrow[locale]}</small>
            </header>
            <h2>{mode.title[locale]}</h2>
            <p>{mode.description[locale]}</p>
            <footer>
              <small>{mode.meta[locale]}</small>
              <b>{mode.action[locale]} →</b>
            </footer>
          </Link>
        ))}
      </section>

      <footer className="mode-lobby-note">
        <span>{locale === "en" ? "REAL HISTORICAL DATA" : "真实历史行情"}</span>
        <span>{locale === "en" ? "TICKER HIDDEN UNTIL REVEAL" : "结算前隐藏股票身份"}</span>
        <span>{locale === "en" ? "NO REAL MONEY" : "不涉及真实资金"}</span>
      </footer>
    </main>
  );
}
