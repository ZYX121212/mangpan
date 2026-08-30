export type ShareChannel =
  | "native"
  | "x"
  | "whatsapp"
  | "telegram"
  | "reddit"
  | "bluesky"
  | "copy";

export type ShareSource = ShareChannel | "direct";

const SHARE_SOURCES = new Set<ShareSource>([
  "native",
  "x",
  "whatsapp",
  "telegram",
  "reddit",
  "bluesky",
  "copy",
  "direct",
]);

type DirectShareChannel = Exclude<ShareChannel, "native" | "copy">;

export function normalizeShareSource(value: unknown): ShareSource {
  return typeof value === "string" && SHARE_SOURCES.has(value as ShareSource)
    ? (value as ShareSource)
    : "direct";
}

export function shareSourceLabel(source: ShareSource, locale: "en" | "zh" = "en") {
  const labels =
    locale === "zh"
      ? ({
          native: "系统分享",
          x: "X",
          whatsapp: "WhatsApp",
          telegram: "Telegram",
          reddit: "Reddit",
          bluesky: "Bluesky",
          copy: "复制链接",
          direct: "直接访问",
        } as const)
      : ({
      native: "System share",
      x: "X",
      whatsapp: "WhatsApp",
      telegram: "Telegram",
      reddit: "Reddit",
      bluesky: "Bluesky",
      copy: "Copied link",
      direct: "Direct",
        } as const);
  return labels[source];
}

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
  if (channel === "telegram") {
    const query = new URLSearchParams({ url: taggedUrl, text });
    return `https://t.me/share/url?${query}`;
  }
  if (channel === "reddit") {
    const query = new URLSearchParams({ url: taggedUrl, title: text });
    return `https://www.reddit.com/submit?${query}`;
  }
  const query = new URLSearchParams({ text: `${text}\n${taggedUrl}` });
  return `https://bsky.app/intent/compose?${query}`;
}
