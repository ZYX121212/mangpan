import type { Metadata } from "next";
import GameModePage from "../game-mode-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Endless Practice | Blind Trading",
  description: "Explore random real historical charts at your own pace without rankings.",
  alternates: { canonical: "/practice" },
};

export default function PracticePage({
  searchParams,
}: {
  searchParams?: Promise<{ market?: string }>;
}) {
  return <GameModePage mode="practice" searchParams={searchParams} />;
}
