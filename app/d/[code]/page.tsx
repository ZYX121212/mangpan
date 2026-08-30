import type { Metadata } from "next";
import Link from "next/link";
import GameClient from "../../game-client";
import { getChatGPTUser } from "../../chatgpt-auth";
import { startDuelSession } from "../../challenge-sessions";
import { getPublicDuelInvite } from "../../duel-invites";
import { opaquePlayerId } from "../../request-identity";
import { normalizeShareSource } from "../../share-links";

export const dynamic = "force-dynamic";

const SITE_ORIGIN = "https://mangpan-kline-game.hiayun.chatgpt.site";
const FALLBACK_SHARE_IMAGE = {
  url: "/og.png",
  width: 1672,
  height: 941,
  alt: "Blind Trading — Trade the setup, not the ticker",
};

function unavailableMetadata(): Metadata {
  const title = "This Blind Trading challenge is unavailable";
  const description =
    "Play today's hidden historical market chart and challenge a friend on the exact same setup.";
  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description,
      type: "website",
      images: [FALLBACK_SHARE_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [FALLBACK_SHARE_IMAGE.url],
    },
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
  const imagePath = `${path}/opengraph-image`;
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
      images: [
        {
          url: imagePath,
          width: 1200,
          height: 630,
          alt: `${invite.challengerNickname}'s Blind Trading friend challenge`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imagePath],
    },
  };
}

function DuelUnavailable() {
  return (
    <main className="duel-route-state">
      <Link className="duel-route-brand" href="/" aria-label="Blind Trading home">
        <span>B</span>
        <b>BLIND TRADING</b>
      </Link>
      <section>
        <small>CHALLENGE UNAVAILABLE</small>
        <h1>We couldn’t find this duel.</h1>
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
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ via?: string | string[] }>;
}) {
  const { code } = await params;
  const query = await searchParams;
  const source = normalizeShareSource(
    Array.isArray(query.via) ? query.via[0] : query.via,
  );
  const invite = await getPublicDuelInvite(code);
  if (!invite) return <DuelUnavailable />;
  const user = await getChatGPTUser();
  const playerId = user ? await opaquePlayerId(user.userId) : undefined;
  const challenge = await startDuelSession(invite.challengeId, playerId);
  return (
    <GameClient
      initialChallenge={challenge}
      initialIdentity={playerId ? { playerId, cloud: true } : null}
      initialDuel={{ code: invite.code, date: invite.date, source }}
      initialMode="daily"
    />
  );
}
