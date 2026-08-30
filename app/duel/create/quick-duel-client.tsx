"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { trackActivationEvent } from "../../activation-events";
import GameClient, { type ChallengeSession } from "../../game-client";
import GameLoading from "../../game-loading";
import type { MarketKind } from "../../game-config";

type QuickDuel = {
  session: ChallengeSession;
  duel: { code: string; date: string; chainDepth: number };
};

function localPlayer() {
  let playerId = localStorage.getItem("mangpan-player-id");
  if (!playerId) {
    playerId = crypto.randomUUID();
    localStorage.setItem("mangpan-player-id", playerId);
  }
  const nickname =
    localStorage.getItem("mangpan-player-name") ||
    `Reader-${playerId.slice(-4).toUpperCase()}`;
  return { playerId, nickname };
}

export default function QuickDuelClient({ market }: { market: MarketKind }) {
  const [duel, setDuel] = useState<QuickDuel | null>(null);
  const [error, setError] = useState(false);
  const requestRef = useRef<Promise<QuickDuel> | null>(null);

  useEffect(() => {
    const { playerId, nickname } = localPlayer();
    let cancelled = false;
    const request = requestRef.current ?? fetch("/api/duels/quick", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ market, playerId, nickname }),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("duel unavailable");
        return (await response.json()) as QuickDuel;
      });
    requestRef.current = request;
    request
      .then((next) => {
        if (cancelled) return;
        setDuel(next);
        trackActivationEvent(playerId, "duel_instant_create", "duel");
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [market]);

  if (error)
    return (
      <main className="duel-create-error">
        <section>
          <small>ROOM UNAVAILABLE</small>
          <h1>We couldn’t open this private duel.</h1>
          <p>Your daily challenge and existing friend rooms are still available.</p>
          <Link href={`/duel?market=${market}`}>Return to Friend Duel →</Link>
        </section>
      </main>
    );
  if (!duel) return <GameLoading mode="duel" />;
  return (
    <GameClient
      initialChallenge={duel.session}
      initialIdentity={null}
      initialDuel={{
        code: duel.duel.code,
        date: duel.duel.date,
        source: "direct",
        chainDepth: duel.duel.chainDepth,
      }}
      initialMode="daily"
    />
  );
}
