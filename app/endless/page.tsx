import type { Metadata } from "next";
import GameModePage from "../game-mode-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Endless | Blind Trading",
  description:
    "Stay with one hidden real historical market cycle, make decisions at your own pace, and build a deeper trading record.",
  alternates: { canonical: "/endless" },
};

export default function EndlessPage({
  searchParams,
}: {
  searchParams?: Promise<{ market?: string }>;
}) {
  return <GameModePage mode="endless" searchParams={searchParams} />;
}
