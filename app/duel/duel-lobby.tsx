"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";
import {
  Localized,
  localeLanguageTag,
  normalizeLocale,
  type Locale,
} from "../i18n";
import type { MarketKind } from "../game-config";
import { safeLocalStorage } from "../safe-storage";

export default function DuelLobby() {
  const [locale, setLocale] = useState<Locale>("en");
  const [market, setMarket] = useState<MarketKind>("us");
  const [code, setCode] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const resolvedLocale = normalizeLocale(
        safeLocalStorage.getItem("mangpan-locale") ||
          navigator.languages?.[0] ||
          navigator.language,
      );
      setLocale(resolvedLocale);
      document.documentElement.lang = localeLanguageTag(resolvedLocale);
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
    <Localized locale={locale}>
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
        <h1>{locale === "en" ? "Start or join a friend duel" : "发起或加入好友同图对决"}</h1>
        <p>
          {locale === "en"
            ? "Open a private room immediately, invite a friend, then race through the exact same hidden historical chart. Scores stay hidden until each player finishes."
            : "立即创建私密房间并邀请好友；双方挑战完全相同的隐藏历史行情，各自完成前成绩保持隐藏。"}
        </p>
        <Link className="duel-create-action" href={`/duel/create?market=${market}`}>
          <span>{locale === "en" ? "NEW PRIVATE ROOM" : "新建私密房间"}</span>
          <b>{locale === "en" ? "Create instant duel" : "立即创建对决"}</b>
          <small>
            {locale === "en"
              ? "Invite now · play in parallel · no sign-up"
              : "立即邀请 · 同时作答 · 无需注册"}
          </small>
          <strong aria-hidden="true">→</strong>
        </Link>
        <div className="duel-lobby-divider">
          <span>{locale === "en" ? "OR JOIN WITH A CODE" : "或使用挑战码加入"}</span>
        </div>
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
        <p className="duel-lobby-note-copy">
          {locale === "en"
            ? "Already received a full invite link? Open it directly—no code entry needed."
            : "如果已经收到完整邀请链接，直接打开即可，无需再次输入挑战码。"}
        </p>
      </section>
      <footer className="duel-lobby-proof">
        <span>{locale === "en" ? "EXACT SAME CHART" : "完全相同的行情"}</span>
        <span>{locale === "en" ? "VERIFIED SCORE" : "服务器复算得分"}</span>
        <span>{locale === "en" ? "NO SIGN-UP" : "无需注册"}</span>
      </footer>
      </main>
    </Localized>
  );
}
