import type { Metadata } from "next";
import Link from "next/link";
import { getCrewSummary } from "../../crew-service";
import CrewRoomClient from "./crew-room-client";

export const dynamic = "force-dynamic";

const SITE_ORIGIN = "https://mangpan-kline-game.hiayun.chatgpt.site";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  const crew = await getCrewSummary(code);
  if (!crew)
    return {
      title: "Crew unavailable | Blind Trading",
      robots: { index: false, follow: false },
    };
  const title = `${crew.name} is building a ${crew.currentStreak}-day Crew Streak`;
  const description = `${crew.completedToday}/${crew.memberCount} complete today. Join up to five friends, read one hidden chart each, and keep the shared flame alive.`;
  const path = `/c/${crew.code}`;
  const image = `${path}/opengraph-image`;
  return {
    title,
    description,
    alternates: { canonical: path },
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description,
      type: "website",
      url: `${SITE_ORIGIN}${path}`,
      images: [{ url: image, width: 1200, height: 630, alt: `${crew.name} Crew Streak invitation` }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default async function CrewRoomPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const crew = await getCrewSummary(code);
  if (!crew)
    return (
      <main className="crew-route-unavailable">
        <Link className="mode-lobby-brand" href="/"><span>B</span><b>BLIND TRADING</b></Link>
        <section>
          <small>CREW UNAVAILABLE</small>
          <h1>This crew link is no longer available.</h1>
          <p>Start a new shared daily streak and invite up to four friends.</p>
          <Link href="/crew">Start a Crew Streak →</Link>
        </section>
      </main>
    );
  return <CrewRoomClient initialCrew={crew} />;
}
