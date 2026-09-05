import GameModePage from "../game-mode-page";

export default function QuickReadPage({
  searchParams,
}: {
  searchParams?: Promise<{ market?: string }>;
}) {
  return <GameModePage mode="sprint" searchParams={searchParams} />;
}
