import type { Metadata } from "next";
import GameModePage from "../game-mode-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Quick Read | Blind Trading",
  description:
    "Make three fast decisions on a hidden historical chart and learn your instinct before the next move.",
  alternates: { canonical: "/quick-read" },
};

export default function QuickReadPage({
  searchParams,
}: {
  searchParams?: Promise<{ market?: string }>;
}) {
  return <GameModePage mode="sprint" searchParams={searchParams} />;
}
