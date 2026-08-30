"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { trackActivationEvent } from "../../activation-events";
import type { CrewSummary } from "../../crew-service";
import {
  Localized,
  localeLanguageTag,
  normalizeLocale,
  type Locale,
} from "../../i18n";
import {
  createPlatformCrewShareUrl,
  getWebGameLaunchContext,
  reportPlatformLoaded,
} from "../../web-game-platform";

function ensureLocalPlayerId() {
  const existing = localStorage.getItem("mangpan-player-id");
  if (existing) return existing;
  const created = crypto.randomUUID();
  localStorage.setItem("mangpan-player-id", created);
  return created;
}

export default function CrewRoomClient({ initialCrew }: { initialCrew: CrewSummary }) {
  const [crew, setCrew] = useState(initialCrew);
  const [locale, setLocale] = useState<Locale>("en");
  const [playerId, setPlayerId] = useState("");
  const [nickname, setNickname] = useState("");
  const [status, setStatus] = useState("");
  const remaining = useMemo(
    () => crew.members.filter((member) => !member.completedToday && !member.isViewer),
    [crew.members],
  );
  const viewerCompletedToday = crew.members.some(
    (member) => member.isViewer && member.completedToday,
  );

  useEffect(() => {
    reportPlatformLoaded();
    let cancelled = false;
    const timer = window.setTimeout(() => {
      const id = ensureLocalPlayerId();
      const savedNickname = localStorage.getItem("mangpan-player-name");
      const resolvedLocale = normalizeLocale(
        localStorage.getItem("mangpan-locale") ||
          navigator.languages?.[0] ||
          navigator.language,
      );
      setLocale(resolvedLocale);
      document.documentElement.lang = localeLanguageTag(resolvedLocale);
      setPlayerId(id);
      setNickname(savedNickname || `Trader ${id.slice(-4).toUpperCase()}`);
      trackActivationEvent(id, "crew_view", "crew");
      void getWebGameLaunchContext().then((context) => {
        if (!cancelled && context.locale) {
          setLocale(context.locale);
          document.documentElement.lang = localeLanguageTag(context.locale);
        }
      });
      void fetch(`/api/crews?code=${encodeURIComponent(initialCrew.code)}&playerId=${encodeURIComponent(id)}`)
        .then((response) => response.json())
        .then((payload: { crew?: CrewSummary }) => {
          if (payload.crew) setCrew(payload.crew);
        })
        .catch(() => undefined);
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [initialCrew.code]);

  const join = async () => {
    if (!playerId) return;
    setStatus(locale === "en" ? "Joining crew…" : "正在加入小队…");
    try {
      const response = await fetch("/api/crews", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "join", code: crew.code, playerId, nickname }),
      });
      const payload = (await response.json()) as { crew?: CrewSummary; error?: string };
      if (!response.ok || !payload.crew) throw new Error(payload.error || "Could not join crew.");
      setCrew(payload.crew);
      setStatus(locale === "en" ? "You’re in. Finish today’s chart." : "加入成功，去完成今日盲盘吧。 ");
      trackActivationEvent(playerId, "crew_join", "crew");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not join crew.");
    }
  };

  const share = async (kind: "invite" | "nudge") => {
    const baseUrl = `${location.origin}/c/${crew.code}`;
    const standaloneUrl = `${baseUrl}?via=${kind}`;
    const people = kind === "nudge" ? remaining.map((member) => member.nickname).join(", ") : "";
    const text = kind === "nudge"
      ? locale === "en"
        ? `${people || "Crew"}, ${crew.name} is waiting: ${crew.completedToday}/${crew.memberCount} done today. Keep our ${crew.currentStreak}-day Blind Trading streak alive.`
        : `${people || "小队成员"}，${crew.name} 正等你：今天 ${crew.completedToday}/${crew.memberCount} 人已完成。一起守住 ${crew.currentStreak} 天连续纪录。`
      : locale === "en"
        ? `Join ${crew.name} on Blind Trading. One hidden chart each day; the crew streak grows only when everyone finishes.`
        : `加入 ${crew.name} 的盲盘小队：每天每人完成一张隐藏行情，只有全员完成才会延续共同纪录。`;
    try {
      const url = await createPlatformCrewShareUrl(crew.code, standaloneUrl);
      if (!url) throw new Error("platform invite unavailable");
      if (navigator.share) await navigator.share({ title: `${crew.name} · Crew Streak`, text, url });
      else await navigator.clipboard.writeText(`${text}\n${url}`);
      setStatus(locale === "en" ? (kind === "nudge" ? "Reminder shared" : "Invite shared") : kind === "nudge" ? "提醒已分享" : "邀请已分享");
      if (playerId) {
        trackActivationEvent(
          playerId,
          kind === "invite" && crew.memberCount === 1
            ? "crew_first_invite_share"
            : "crew_invite_share",
          "crew",
        );
      }
    } catch {
      setStatus(locale === "en" ? "Share cancelled" : "已取消分享");
    }
  };

  const slots = Array.from({ length: crew.capacity }, (_, index) =>
    crew.members.find((member) => member.slot === index + 1) ?? null,
  );

  return (
    <Localized locale={locale}>
      <main className="crew-room-page">
      <header className="crew-topbar">
        <Link className="mode-lobby-brand" href="/"><span>B</span><b>BLIND TRADING</b></Link>
        <Link href="/crew">{locale === "en" ? "Crew Streaks" : "小队连续纪录"}</Link>
      </header>

      <section className="crew-room-hero">
        <div>
          <small>{crew.market === "us" ? "U.S. MARKET CREW" : "A-SHARE MARKET CREW"} · {crew.code}</small>
          <h1>{crew.name}</h1>
          <p>{locale === "en" ? "One daily chart each. The flame grows only when every crew member finishes." : "每天每人完成一张盲盘；只有全员完成，共同火焰才会延续。"}</p>
        </div>
        <div className="crew-flame" data-active={crew.currentStreak > 0}>
          <i>🔥</i>
          <strong>{crew.currentStreak}</strong>
          <span>{locale === "en" ? "DAY CREW STREAK" : "天共同连续"}</span>
          <small>{locale === "en" ? `Best ${crew.bestStreak}` : `最佳 ${crew.bestStreak} 天`}</small>
        </div>
      </section>

      <section className="crew-today-card">
        <header>
          <div><small>TODAY’S COMMITMENT</small><h2>{crew.allDoneToday ? (locale === "en" ? "The whole crew showed up." : "全员到齐。") : (locale === "en" ? `${crew.completedToday} of ${crew.memberCount} finished` : `${crew.completedToday}/${crew.memberCount} 人已完成`)}</h2></div>
          <span>{crew.allDoneToday ? "COMPLETE" : `${Math.round((crew.completedToday / Math.max(1, crew.memberCount)) * 100)}%`}</span>
        </header>
        <div className="crew-progress"><i style={{ width: `${(crew.completedToday / Math.max(1, crew.memberCount)) * 100}%` }} /></div>
        <div className="crew-member-grid">
          {slots.map((member, index) => member ? (
            <article className={member.completedToday ? "done" : "waiting"} key={`${member.nickname}-${index}`}>
              <i>{member.completedToday ? "✓" : String(index + 1).padStart(2, "0")}</i>
              <span><b>{member.nickname}{member.isViewer ? (locale === "en" ? " · YOU" : " · 你") : ""}</b><small>{member.completedToday ? (locale === "en" ? "Done today" : "今日已完成") : (locale === "en" ? "Waiting today" : "今日待完成")}</small></span>
            </article>
          ) : (
            <article className="empty" key={`empty-${index}`}><i>+</i><span><b>{locale === "en" ? "Open slot" : "空位"}</b><small>{locale === "en" ? "Invite a friend" : "邀请好友"}</small></span></article>
          ))}
        </div>
      </section>

      <section className="crew-room-actions">
        {!crew.isMember ? (
          <div className="crew-join-cta">
            <div><small>PRIVATE CREW INVITE</small><h2>{locale === "en" ? "Take one of the open seats" : "加入这支小队"}</h2><p>{locale === "en" ? "Your score stays yours. Only today’s completion status is shared with the crew." : "分数仍属于你自己，小队只共享每日完成状态。"}</p></div>
            <button disabled={crew.memberCount >= crew.capacity || status.includes("…")} onClick={() => void join()}>{crew.memberCount >= crew.capacity ? (locale === "en" ? "Crew full" : "小队已满") : (locale === "en" ? "Join Crew Streak →" : "加入小队 →")}</button>
          </div>
        ) : crew.memberCount === 1 ? (
          <div className="crew-activation-gate">
            <div>
              <small>CREW NOT ACTIVE YET</small>
              <h2>{locale === "en" ? "Invite one teammate to light the flame" : "邀请一位队友，点燃共同火焰"}</h2>
              <p>{locale === "en" ? "A Crew Streak starts with two people. Your first invite is the only step left." : "共同连续纪录至少需要两个人。现在只差发出第一份邀请。"}</p>
            </div>
            <div>
              <button onClick={() => void share("invite")}>{locale === "en" ? "Invite first teammate →" : "邀请首位队友 →"}</button>
              <Link href={`/daily?market=${crew.market}&crew=${crew.code}`}>{viewerCompletedToday ? (locale === "en" ? "Review today’s result while you wait →" : "等待时查看今日结果 →") : (locale === "en" ? "Play today’s chart while you wait →" : "等待时完成今日盲盘 →")}</Link>
            </div>
          </div>
        ) : (
          <div className="crew-member-actions">
            <Link href={`/daily?market=${crew.market}&crew=${crew.code}`}>{viewerCompletedToday ? (locale === "en" ? "Review today’s result →" : "查看今日结果 →") : (locale === "en" ? "Play today’s chart →" : "完成今日盲盘 →")}</Link>
            {remaining.length > 0 && <button onClick={() => void share("nudge")}>{locale === "en" ? `Nudge ${remaining.length} waiting →` : `提醒 ${remaining.length} 位待完成人员 →`}</button>}
          </div>
        )}
        {crew.isMember && crew.memberCount > 1 && <button className="crew-invite-button" onClick={() => void share("invite")}>{locale === "en" ? "Invite another friend" : "邀请更多好友"}</button>}
        {status && <p className="crew-form-status" role="status">{status}</p>}
      </section>

      <footer className="crew-room-proof">
        <span>{locale === "en" ? "MAX 5 MEMBERS" : "最多五人"}</span>
        <span>{locale === "en" ? "PRIVATE BY LINK" : "仅凭链接加入"}</span>
        <span>{locale === "en" ? "NO REAL MONEY" : "不涉及真实资金"}</span>
      </footer>
      </main>
    </Localized>
  );
}
