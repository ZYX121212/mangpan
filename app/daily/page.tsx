import type { Metadata } from "next";
import GameModePage from "../game-mode-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Daily Challenge | Blind Trading",
  description: "Five decisions on the same hidden historical chart as everyone else.",
  alternates: { canonical: "/daily" },
};

export default function DailyPage({
  searchParams,
}: {
  searchParams?: Promise<{ market?: string }>;
}) {
  return <GameModePage mode="daily" searchParams={searchParams} />;
}
