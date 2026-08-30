import { ImageResponse } from "next/og";
import { getPublicDuelInvite } from "../../duel-invites";

export const alt = "Blind Trading friend challenge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const dynamic = "force-dynamic";

function safeNickname(value: string) {
  const nickname = value.trim();
  return nickname.length > 24 ? `${nickname.slice(0, 23)}…` : nickname;
}

export default async function DuelOpenGraphImage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const invite = await getPublicDuelInvite(code);
  const challenger = invite ? safeNickname(invite.challengerNickname) : "A friend";
  const market = invite?.market === "cn" ? "CHINA A-SHARE" : "U.S. STOCK";
  const answers = invite?.responseCount ?? 0;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        padding: "64px 72px",
        position: "relative",
        overflow: "hidden",
        background: "#f4f1e9",
        color: "#282b25",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          width: 500,
          height: 500,
          position: "absolute",
          right: -150,
          top: -230,
          borderRadius: 250,
          background: "#daceaa",
          opacity: 0.48,
        }}
      />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          fontSize: 21,
          fontWeight: 800,
          letterSpacing: 4,
        }}
      >
        <div
          style={{
            width: 52,
            height: 52,
            marginRight: 18,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "2px solid #282b25",
            borderRadius: 14,
            fontFamily: "Georgia, serif",
            fontSize: 29,
          }}
        >
          B
        </div>
        BLIND TRADING
      </div>

      <div style={{ display: "flex", flex: 1, alignItems: "center" }}>
        <div style={{ display: "flex", flex: 1, flexDirection: "column" }}>
          <div
            style={{
              marginBottom: 18,
              display: "flex",
              color: "#7d7d74",
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: 3,
            }}
          >
            FRIEND DUEL · {market}
          </div>
          <div
            style={{
              maxWidth: 690,
              display: "flex",
              flexDirection: "column",
              fontSize: 54,
              fontWeight: 800,
              lineHeight: 1.08,
              letterSpacing: -2,
            }}
          >
            <span>{challenger} set the score.</span>
            <span>Can you beat it?</span>
          </div>
          <div
            style={{
              marginTop: 24,
              display: "flex",
              color: "#72736c",
              fontSize: 22,
            }}
          >
            Same hidden chart · Five decisions · Zero spoilers
          </div>
        </div>

        <div
          style={{
            width: 260,
            height: 260,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 34,
            background: "#2d3029",
            color: "#fff",
            boxShadow: "0 25px 60px rgba(31, 33, 28, 0.18)",
          }}
        >
          <span
            style={{
              marginBottom: 13,
              color: "#bbc0b5",
              fontSize: 15,
              fontWeight: 700,
              letterSpacing: 3,
            }}
          >
            SCORE TO BEAT
          </span>
          <strong
            style={{
              fontFamily: "Arial, sans-serif",
              fontSize: 92,
              lineHeight: 1,
              letterSpacing: -5,
            }}
          >
            {invite?.targetScore ?? "?"}
          </strong>
          <span style={{ marginTop: 13, color: "#bbc0b5", fontSize: 16 }}>
            {answers ? `${answers} answered` : "Be the first"}
          </span>
        </div>
      </div>

      <div
        style={{
          paddingTop: 22,
          display: "flex",
          justifyContent: "space-between",
          borderTop: "1px solid #d1cdc2",
          color: "#85857d",
          fontSize: 16,
          fontWeight: 700,
          letterSpacing: 2,
        }}
      >
        <span>REAL HISTORICAL MARKET · NO SIGN-UP</span>
        <span>PLAY THE SAME CHART →</span>
      </div>
    </div>,
    size,
  );
}
