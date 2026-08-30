import type { Metadata } from "next";
import LegalPage from "../legal-page";

export const metadata: Metadata = {
  title: "Privacy | Blind Trading",
  description: "How Blind Trading handles account, gameplay, and device data.",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <section>
        <h2>What we collect</h2>
        <p>
          Blind Trading stores the player name you choose, gameplay decisions,
          scores, training progress, challenge participation, and related
          timestamps. For friend challenges, it also records whether an anonymous
          player opened or started a room and which share button was used, so the
          room host can see aggregate challenge progress. It also records anonymous
          first-play milestones such as opening the lobby, starting the guide,
          making the first forecast, and completing a run so onboarding can be
          improved. If you use Sign in with ChatGPT, the hosting platform
          provides an account identifier so progress can sync; Blind Trading stores
          a one-way derived player identifier rather than the original account ID.
        </p>
      </section>
      <section>
        <h2>Data on your device</h2>
        <p>
          Local storage keeps your language preference, anonymous player ID,
          player name, active-session reference, and training progress so the game
          can resume on the same device. You can remove this data through your
          browser settings.
        </p>
      </section>
      <section>
        <h2>How data is used</h2>
        <ul>
          <li>Operate sessions, leaderboards, training, and friend challenges.</li>
          <li>Prevent duplicate or manipulated score submissions.</li>
          <li>Show room hosts aggregate friend-challenge conversion progress.</li>
          <li>Measure aggregate first-play completion and improve onboarding.</li>
          <li>Maintain reliability, security, and product performance.</li>
        </ul>
        <p>
          We do not sell personal information, use it to execute trades, or use IP
          addresses, device fingerprints, or third-party advertising trackers to
          measure friend challenges.
        </p>
      </section>
      <section>
        <h2>Public information</h2>
        <p>
          Your chosen player name, score, return, and ranking may appear on public
          leaderboards. Do not use a player name that reveals information you do
          not want to make public.
        </p>
      </section>
      <section>
        <h2>Service providers and contact</h2>
        <p>
          The service relies on OpenAI Sites and Cloudflare infrastructure for
          hosting, authentication, storage, security, and delivery. To ask a
          privacy question or request deletion of associated gameplay data, open
          an issue in the project&apos;s{" "}
          <a href="https://github.com/ZYX121212/mangpan/issues">GitHub tracker</a>.
        </p>
      </section>
    </LegalPage>
  );
}
