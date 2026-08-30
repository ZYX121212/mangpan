import type { Metadata } from "next";
import Link from "next/link";
import GameClient from "../../game-client";
import { getChatGPTUser } from "../../chatgpt-auth";
import { startDailySession } from "../../challenge-sessions";
import { getPublicDuelInvite } from "../../duel-invites";
import { marketDate } from "../../game-config";
import { opaquePlayerId } from "../../request-identity";

export const dynamic = "force-dynamic";

const SITE_ORIGIN = "https://mangpan-kline-game.hiayun.chatgpt.site";

function unavailableMetadata(): Metadata {
  const title = "This Blind Trading challenge is unavailable";
  const description =
    "Play today's hidden historical market chart and challenge a friend on the exact same setup.";
  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: { title, description, type: "website", images: [] },
    twitter: { card: "summary", title, description, images: [] },
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  const invite = await getPublicDuelInvite(code);
  if (!invite) return unavailableMetadata();
  const market = invite.market === "us" ? "U.S. stock" : "China A-share";
  const title = `${invite.challengerNickname} scored ${invite.targetScore}. Can you beat it? | Blind Trading`;
  const roomProof = invite.responseCount
    ? `${invite.responseCount} ${invite.responseCount === 1 ? "player has" : "players have"} answered. `
    : "";
  const description = `${roomProof}The same hidden historical ${market} chart. Five decisions. No ticker, no future, no sign-up.`;
  const path = `/d/${invite.code}`;
  return {
    title,
    description,
    alternates: { canonical: path },
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description,
      type: "website",
      url: `${SITE_ORIGIN}${path}`,
      images: [],
    },
    twitter: { card: "summary", title, description, images: [] },
  };
}

function DuelUnavailable({ expired }: { expired: boolean }) {
  return (
    <main className="duel-route-state">
      <Link className="duel-route-brand" href="/" aria-label="Blind Trading home">
        <span>B</span>
        <b>BLIND TRADING</b>
      </Link>
      <section>
        <small>{expired ? "CHALLENGE EXPIRED" : "CHALLENGE UNAVAILABLE"}</small>
        <h1>{expired ? "This duel has closed." : "We couldn’t find this duel."}</h1>
        <p>
          Daily charts reset together for everyone. Today’s mystery market is
          ready—and you can send a fresh same-chart challenge after you finish.
        </p>
        <Link href="/daily">Play today’s challenge →</Link>
      </section>
    </main>
  );
}

export default async function DuelPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const invite = await getPublicDuelInvite(code);
  if (!invite) return <DuelUnavailable expired={false} />;
  if (invite.date !== marketDate(invite.market))
    return <DuelUnavailable expired />;
  const user = await getChatGPTUser();
  const playerId = user ? await opaquePlayerId(user.userId) : undefined;
  const challenge = await startDailySession(
    invite.date,
    invite.market,
    playerId,
  );
  return (
    <GameClient
      initialChallenge={challenge}
      initialIdentity={playerId ? { playerId, cloud: true } : null}
      initialDuel={{ code: invite.code, date: invite.date }}
      initialMode="daily"
    />
  );
}
