import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeShareSource,
  shareComparisonHook,
  shareSourceLabel,
  socialShareHref,
  taggedChallengeUrl,
} from "../app/share-links.ts";

const challenge = "https://blind.example/d/ABC12345?room=daily";
const message = "I scored 82. Can you beat me? 🟩🟨🟩";

test("tags every challenge link with its actual share channel", () => {
  const tagged = new URL(taggedChallengeUrl(challenge, "copy"));
  assert.equal(tagged.pathname, "/d/ABC12345");
  assert.equal(tagged.searchParams.get("room"), "daily");
  assert.equal(tagged.searchParams.get("via"), "copy");
});

test("accepts only known attribution sources and safely defaults to direct", () => {
  assert.equal(normalizeShareSource("whatsapp"), "whatsapp");
  assert.equal(normalizeShareSource("reddit"), "reddit");
  assert.equal(normalizeShareSource("bluesky"), "bluesky");
  assert.equal(normalizeShareSource("qr"), "qr");
  assert.equal(normalizeShareSource("WHATSAPP"), "direct");
  assert.equal(normalizeShareSource("<script>"), "direct");
  assert.equal(normalizeShareSource(["x"]), "direct");
  assert.equal(shareSourceLabel("native"), "System share");
  assert.equal(shareSourceLabel("qr"), "Share-card QR");
});

test("tags image QR scans separately from visible share actions", () => {
  const tagged = new URL(taggedChallengeUrl(challenge, "qr"));
  assert.equal(tagged.pathname, "/d/ABC12345");
  assert.equal(tagged.searchParams.get("via"), "qr");
});

test("surfaces comparison proof only when it is worth sharing", () => {
  assert.equal(shareComparisonHook(82.4), "Beat 82% of players today");
  assert.equal(shareComparisonHook(82.4, "zh"), "今日领先 82% 玩家");
  assert.equal(shareComparisonHook(69.9), null);
  assert.equal(shareComparisonHook(Number.NaN), null);
  assert.equal(shareComparisonHook(108), "Beat 100% of players today");
  assert.equal(shareComparisonHook(82.4, "de"), "Heute besser als 82% der Spieler");
  assert.equal(shareComparisonHook(82.4, "it"), "Hai superato il 82% dei giocatori oggi");
  assert.equal(shareComparisonHook(82.4, "fr"), "Tu devances 82% des joueurs aujourd’hui");
});

test("localizes share-source labels for every supported overseas locale", () => {
  assert.equal(shareSourceLabel("qr", "de"), "QR-Code der Karte");
  assert.equal(shareSourceLabel("whatsapp", "it"), "WhatsApp");
  assert.equal(shareSourceLabel("copy", "es"), "Enlace copiado");
  assert.equal(shareSourceLabel("direct", "fr"), "Direct");
});

test("builds an encoded X intent with a separately tagged URL", () => {
  const intent = new URL(socialShareHref("x", challenge, message));
  assert.equal(intent.origin, "https://twitter.com");
  assert.equal(intent.pathname, "/intent/tweet");
  assert.equal(intent.searchParams.get("text"), message);
  const shared = new URL(intent.searchParams.get("url"));
  assert.equal(shared.searchParams.get("via"), "x");
});

test("builds WhatsApp and Telegram shares without losing Unicode", () => {
  const whatsapp = new URL(
    socialShareHref("whatsapp", challenge, message),
  );
  assert.equal(whatsapp.origin, "https://wa.me");
  assert.match(whatsapp.searchParams.get("text"), /🟩🟨🟩/u);
  assert.match(whatsapp.searchParams.get("text"), /via=whatsapp/);

  const telegram = new URL(socialShareHref("telegram", challenge, message));
  assert.equal(telegram.origin, "https://t.me");
  assert.equal(telegram.pathname, "/share/url");
  assert.equal(telegram.searchParams.get("text"), message);
  const shared = new URL(telegram.searchParams.get("url"));
  assert.equal(shared.searchParams.get("via"), "telegram");
});

test("builds Reddit and Bluesky shares with distinct attribution", () => {
  const reddit = new URL(socialShareHref("reddit", challenge, message));
  assert.equal(reddit.origin, "https://www.reddit.com");
  assert.equal(reddit.pathname, "/submit");
  assert.equal(reddit.searchParams.get("title"), message);
  assert.equal(
    new URL(reddit.searchParams.get("url")).searchParams.get("via"),
    "reddit",
  );

  const bluesky = new URL(socialShareHref("bluesky", challenge, message));
  assert.equal(bluesky.origin, "https://bsky.app");
  assert.equal(bluesky.pathname, "/intent/compose");
  assert.match(bluesky.searchParams.get("text"), /🟩🟨🟩/u);
  assert.match(bluesky.searchParams.get("text"), /via=bluesky/);
});
