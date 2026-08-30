import assert from "node:assert/strict";
import test from "node:test";
import {
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
