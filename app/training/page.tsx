import type { Metadata } from "next";
import GameModePage from "../game-mode-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Training Lab | Blind Trading",
  description: "Focused lessons for trends, reversals, crashes, and volatile markets.",
  alternates: { canonical: "/training" },
};

export default function TrainingPage({
  searchParams,
}: {
  searchParams?: Promise<{ market?: string }>;
}) {
  return <GameModePage mode="training" searchParams={searchParams} />;
}
