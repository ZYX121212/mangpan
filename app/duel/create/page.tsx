import type { Metadata } from "next";
import type { MarketKind } from "../../game-config";
import QuickDuelClient from "./quick-duel-client";

export const metadata: Metadata = {
  title: "Create a Friend Duel | Blind Trading",
  description:
    "Open a private same-chart room, invite a friend immediately, and compare verified decisions.",
  robots: { index: false, follow: false },
};

export default async function CreateDuelPage({
  searchParams,
}: {
  searchParams: Promise<{ market?: string }>;
}) {
  const params = await searchParams;
  const market: MarketKind = params.market === "cn" ? "cn" : "us";
  return <QuickDuelClient market={market} />;
}
