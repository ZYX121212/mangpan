"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";
import type { Locale } from "../i18n";
import type { MarketKind } from "../game-config";

export default function DuelLobby() {
  const [locale, setLocale] = useState<Locale>("en");
  const [market, setMarket] = useState<MarketKind>("us");
  const [code, setCode] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (localStorage.getItem("mangpan-locale") === "zh") setLocale("zh");
      const params = new URLSearchParams(location.search);
      if (params.get("market") === "cn") setMarket("cn");
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const join = (event: FormEvent) => {
    event.preventDefault();
    if (!/^[A-Z0-9]{8,12}$/.test(code)) return;
    location.assign(`/d/${encodeURIComponent(code)}`);
  };

  return (
    <main className="duel-lobby-page">
      <header className="duel-lobby-topbar">
        <Link href="/" className="mode-lobby-brand">
          <span>B</span>
          <b>BLIND TRADING</b>
        </Link>
        <Link href="/">{locale === "en" ? "All modes" : "全部模式"}</Link>
      </header>
      <section className="duel-lobby-card">
        <small>SAME CHART · TWO READS</small>
        <h1>{locale === "en" ? "Enter a friend duel" : "进入好友同图对决"}</h1>
        <p>
          {locale === "en"
            ? "Paste the invite code your friend sent. Their trades, return, and the ticker stay hidden until you finish the same five decisions."
            : "输入好友发来的挑战码。完成相同的五次决策前，对方交易、收益和股票身份都会保持隐藏。"}
        </p>
        <form onSubmit={join}>
          <label htmlFor="duel-code">
            {locale === "en" ? "INVITE CODE" : "挑战码"}
          </label>
          <div>
            <input
              id="duel-code"
              value={code}
              maxLength={12}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              placeholder="AB12CD34"
              onChange={(event) =>
                setCode(
                  event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""),
                )
              }
            />
            <button disabled={!/^[A-Z0-9]{8,12}$/.test(code)}>
              {locale === "en" ? "Join duel →" : "加入对决 →"}
            </button>
          </div>
        </form>
        <div className="duel-lobby-divider">
          <span>{locale === "en" ? "OR" : "或者"}</span>
        </div>
        <aside>
          <b>{locale === "en" ? "Want to challenge someone?" : "想发起一个新对决？"}</b>
          <p>
            {locale === "en"
              ? "Finish today’s ranked chart first. Your result screen will create a verified, spoiler-free invite link."
              : "先完成今日排名挑战；结算页会生成一条经过服务器验证、且不剧透的邀请链接。"}
          </p>
          <Link href={`/daily?market=${market}`}>
            {locale === "en" ? "Play Daily Challenge →" : "前往每日挑战 →"}
          </Link>
        </aside>
      </section>
      <footer className="duel-lobby-proof">
        <span>{locale === "en" ? "EXACT SAME CHART" : "完全相同的行情"}</span>
        <span>{locale === "en" ? "VERIFIED SCORE" : "服务器复算得分"}</span>
        <span>{locale === "en" ? "NO SIGN-UP" : "无需注册"}</span>
      </footer>
    </main>
  );
}
