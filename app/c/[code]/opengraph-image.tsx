import { ImageResponse } from "next/og";
import { getCrewSummary } from "../../crew-service";

export const alt = "Blind Trading Crew Streak invitation";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const dynamic = "force-dynamic";

export default async function CrewOpenGraphImage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const crew = await getCrewSummary(code);
  const name = crew?.name ?? "Blind Trading Crew";
  const done = crew?.completedToday ?? 0;
  const members = crew?.memberCount ?? 0;
  const streak = crew?.currentStreak ?? 0;
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", padding: "62px 72px", display: "flex", flexDirection: "column", background: "#f3f0e7", color: "#292c26", fontFamily: "Arial, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", fontSize: 20, fontWeight: 800, letterSpacing: 4 }}><div style={{ width: 52, height: 52, marginRight: 18, display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #292c26", borderRadius: 14, fontSize: 28 }}>B</div>BLIND TRADING · CREW STREAK</div>
      <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}><span style={{ marginBottom: 16, color: "#777970", fontSize: 18, fontWeight: 800, letterSpacing: 3 }}>PRIVATE DAILY CREW · UP TO 5</span><strong style={{ maxWidth: 700, fontSize: 64, lineHeight: 1.02, letterSpacing: -3 }}>{name}</strong><span style={{ marginTop: 22, color: "#696b64", fontSize: 24 }}>One hidden chart each. Nobody gets left behind.</span></div>
        <div style={{ width: 280, height: 280, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", borderRadius: 36, background: "#2f332c", color: "white" }}><span style={{ fontSize: 42 }}>🔥</span><strong style={{ marginTop: 5, fontSize: 86, lineHeight: 1 }}>{streak}</strong><span style={{ marginTop: 8, color: "#bec3b7", fontSize: 16, fontWeight: 800, letterSpacing: 2 }}>DAY CREW STREAK</span></div>
      </div>
      <div style={{ paddingTop: 22, display: "flex", justifyContent: "space-between", borderTop: "1px solid #d0cdc3", color: "#7d7f76", fontSize: 17, fontWeight: 800, letterSpacing: 2 }}><span>{done}/{members} COMPLETE TODAY</span><span>JOIN THE CREW →</span></div>
    </div>,
    size,
  );
}
