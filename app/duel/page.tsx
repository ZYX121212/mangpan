import type { Metadata } from "next";
import DuelLobby from "./duel-lobby";

export const metadata: Metadata = {
  title: "Friend Duel | Blind Trading",
  description: "Challenge a friend on the exact same hidden historical chart.",
  alternates: { canonical: "/duel" },
};

export default function DuelPage() {
  return <DuelLobby />;
}
