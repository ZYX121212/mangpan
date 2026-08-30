import type { Metadata } from "next";
import GameModePage from "../game-mode-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Market Run | Blind Trading",
  description:
    "Read five mystery charts in one escalating run and build a total decision score.",
  alternates: { canonical: "/run" },
};

export default function RunPage({
  searchParams,
}: {
  searchParams?: Promise<{ market?: string }>;
}) {
  return <GameModePage mode="run" searchParams={searchParams} />;
}
