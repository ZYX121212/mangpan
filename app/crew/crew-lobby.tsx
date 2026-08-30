"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";
import { trackActivationEvent } from "../activation-events";
import type { CrewSummary } from "../crew-service";
import type { MarketKind } from "../game-config";
import {
  Localized,
  localeLanguageTag,
  normalizeLocale,
  type Locale,
} from "../i18n";

function ensureLocalPlayerId() {
  const existing = localStorage.getItem("mangpan-player-id");
  if (existing) return existing;
  const created = crypto.randomUUID();
  localStorage.setItem("mangpan-player-id", created);
  return created;
}

export default function CrewLobby() {
  const [locale, setLocale] = useState<Locale>("en");
  const [market, setMarket] = useState<MarketKind>("us");
  const [playerId, setPlayerId] = useState("");
  const [nickname, setNickname] = useState("");
  const [crewName, setCrewName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [crews, setCrews] = useState<CrewSummary[]>([]);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const id = ensureLocalPlayerId();
      const savedLocale = localStorage.getItem("mangpan-locale");
      const savedMarket = localStorage.getItem("mangpan-market");
      const savedNickname = localStorage.getItem("mangpan-player-name");
      const resolvedLocale = normalizeLocale(
        savedLocale || navigator.languages?.[0] || navigator.language,
      );
      setLocale(resolvedLocale);
      document.documentElement.lang = localeLanguageTag(resolvedLocale);
      if (savedMarket === "cn") setMarket("cn");
      setPlayerId(id);
      setNickname(savedNickname || `Trader ${id.slice(-4).toUpperCase()}`);
      trackActivationEvent(id, "crew_view", "crew");
      void fetch(`/api/crews?playerId=${encodeURIComponent(id)}`)
        .then((response) => response.json())
        .then((payload: { crews?: CrewSummary[] }) => setCrews(payload.crews ?? []))
        .catch(() => undefined);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const create = async (event: FormEvent) => {
    event.preventDefault();
    if (!playerId || crewName.trim().length < 2) return;
    setStatus(locale === "en" ? "Creating crew…" : "正在创建小队…");
    try {
      const response = await fetch("/api/crews", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "create",
          playerId,
          nickname,
          name: crewName,
          market,
        }),
      });
      const payload = (await response.json()) as {
        crew?: CrewSummary;
        error?: string;
      };
      if (!response.ok || !payload.crew)
        throw new Error(payload.error || "Crew creation failed.");
      trackActivationEvent(playerId, "crew_create", "crew");
      location.assign(`/c/${payload.crew.code}`);
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : locale === "en"
            ? "Crew creation failed."
            : "小队创建失败。",
      );
    }
  };

  const join = (event: FormEvent) => {
    event.preventDefault();
    if (!/^[A-Z0-9]{8}$/.test(joinCode)) return;
    location.assign(`/c/${encodeURIComponent(joinCode)}`);
  };

  return (
    <Localized locale={locale}>
      <main className="crew-lobby-page">
      <header className="crew-topbar">
        <Link className="mode-lobby-brand" href="/">
          <span>B</span>
          <b>BLIND TRADING</b>
        </Link>
        <Link href="/">{locale === "en" ? "All modes" : "全部模式"}</Link>
      </header>

      <section className="crew-lobby-hero">
        <small>NEW · SHARED DAILY COMMITMENT</small>
        <h1>{locale === "en" ? "Read one chart. Keep the crew alive." : "每人读一张图，一起守住连续纪录。"}</h1>
        <p>
          {locale === "en"
            ? "Create a private crew for up to five friends. Everyone completes today’s chart; the shared flame grows only when nobody is left behind."
            : "创建一个最多五人的私密小队。每个人完成今日盲盘，只有全员完成，共同火焰才会延续。"}
        </p>
        <div className="crew-rule-strip">
          <span>2–5 {locale === "en" ? "FRIENDS" : "位好友"}</span>
          <span>{locale === "en" ? "ONE CHART EACH" : "每人一张图"}</span>
          <span>{locale === "en" ? "NO SIGN-UP" : "无需注册"}</span>
        </div>
      </section>

      <section className="crew-lobby-workspace">
        <form className="crew-create-card" onSubmit={create}>
          <small>START A CREW</small>
          <h2>{locale === "en" ? "Make a daily pact" : "发起每日约定"}</h2>
          <label htmlFor="crew-name">{locale === "en" ? "CREW NAME" : "小队名称"}</label>
          <input
            id="crew-name"
            value={crewName}
            maxLength={24}
            placeholder={locale === "en" ? "Chart Readers" : "盲盘研究所"}
            onChange={(event) => setCrewName(event.target.value)}
          />
          <div className="crew-market-choice" role="group" aria-label="Crew market">
            <button type="button" className={market === "us" ? "active" : ""} onClick={() => setMarket("us")}>U.S.</button>
            <button type="button" className={market === "cn" ? "active" : ""} onClick={() => setMarket("cn")}>A-SHARES</button>
          </div>
          <button className="crew-primary" disabled={crewName.trim().length < 2 || status.includes("…")}>
            {locale === "en" ? "Create crew →" : "创建小队 →"}
          </button>
          {status && <p className="crew-form-status" role="status">{status}</p>}
        </form>

        <form className="crew-join-card" onSubmit={join}>
          <small>HAVE A CODE?</small>
          <h2>{locale === "en" ? "Join your friends" : "加入好友小队"}</h2>
          <p>{locale === "en" ? "Open their invite link or enter the eight-character crew code." : "打开好友邀请链接，或输入八位小队码。"}</p>
          <div>
            <input
              aria-label={locale === "en" ? "Crew code" : "小队码"}
              value={joinCode}
              maxLength={8}
              placeholder="AB12CD34"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => setJoinCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
            />
            <button disabled={!/^[A-Z0-9]{8}$/.test(joinCode)}>{locale === "en" ? "Open →" : "打开 →"}</button>
          </div>
          <aside>
            <b>{locale === "en" ? "Why it works" : "为什么有效"}</b>
            <p>{locale === "en" ? "A small shared commitment turns a solo streak into gentle accountability—without chat spam or a public feed." : "小范围共同承诺，让个人打卡变成温和的相互监督，不需要群聊轰炸或公开动态。"}</p>
          </aside>
        </form>
      </section>

      {crews.length > 0 && (
        <section className="my-crews">
          <header>
            <small>YOUR CREWS</small>
            <span>{crews.length}/5</span>
          </header>
          <div>
            {crews.map((crew) => (
              <Link href={`/c/${crew.code}`} key={crew.code}>
                <i>🔥</i>
                <span><b>{crew.name}</b><small>{crew.completedToday}/{crew.memberCount} {locale === "en" ? "done today" : "今日完成"}</small></span>
                <strong>{crew.currentStreak}</strong>
              </Link>
            ))}
          </div>
        </section>
      )}
      </main>
    </Localized>
  );
}
