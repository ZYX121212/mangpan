export type ShareChannel =
  | "native"
  | "x"
  | "whatsapp"
  | "telegram"
  | "copy";

type DirectShareChannel = Exclude<ShareChannel, "native" | "copy">;

export function taggedChallengeUrl(url: string, channel: ShareChannel) {
  const tagged = new URL(url);
  tagged.searchParams.set("via", channel);
  return tagged.toString();
}

export function socialShareHref(
  channel: DirectShareChannel,
  url: string,
  text: string,
) {
  const taggedUrl = taggedChallengeUrl(url, channel);
  if (channel === "x") {
    const query = new URLSearchParams({ text, url: taggedUrl });
    return `https://twitter.com/intent/tweet?${query}`;
  }
  if (channel === "whatsapp") {
    const query = new URLSearchParams({ text: `${text}\n${taggedUrl}` });
    return `https://wa.me/?${query}`;
  }
  const query = new URLSearchParams({ url: taggedUrl, text });
  return `https://t.me/share/url?${query}`;
}
