import GameModePage from "../game-mode-page";

export default function EndlessPage({
  searchParams,
}: {
  searchParams?: Promise<{ market?: string }>;
}) {
  return <GameModePage mode="endless" searchParams={searchParams} />;
}
