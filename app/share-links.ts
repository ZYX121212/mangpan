export type ShareChannel =
  | "native"
  | "x"
  | "whatsapp"
  | "telegram"
  | "reddit"
  | "bluesky"
  | "qr"
  | "copy";

export type ShareSource = ShareChannel | "direct";
export type ShareLocale = "en" | "zh" | "es" | "fr" | "de" | "it";

const SHARE_SOURCES = new Set<ShareSource>([
  "native",
  "x",
  "whatsapp",
  "telegram",
  "reddit",
  "bluesky",
  "qr",
  "copy",
  "direct",
]);

type DirectShareChannel = Exclude<ShareChannel, "native" | "copy" | "qr">;

export function normalizeShareSource(value: unknown): ShareSource {
  return typeof value === "string" && SHARE_SOURCES.has(value as ShareSource)
    ? (value as ShareSource)
    : "direct";
}

export function shareSourceLabel(source: ShareSource, locale: ShareLocale = "en") {
  const labels =
    locale === "zh"
      ? ({
          native: "系统分享",
          x: "X",
          whatsapp: "WhatsApp",
          telegram: "Telegram",
          reddit: "Reddit",
          bluesky: "Bluesky",
          qr: "分享图二维码",
          copy: "复制链接",
          direct: "直接访问",
        } as const)
      : locale === "es"
        ? ({
            native: "Compartir del sistema",
            x: "X",
            whatsapp: "WhatsApp",
            telegram: "Telegram",
            reddit: "Reddit",
            bluesky: "Bluesky",
            qr: "QR de la tarjeta",
            copy: "Enlace copiado",
            direct: "Directo",
          } as const)
        : locale === "fr"
          ? ({
              native: "Partage système",
              x: "X",
              whatsapp: "WhatsApp",
              telegram: "Telegram",
              reddit: "Reddit",
              bluesky: "Bluesky",
              qr: "QR de la carte",
              copy: "Lien copié",
              direct: "Direct",
            } as const)
          : locale === "de"
            ? ({
                native: "Systemfreigabe",
                x: "X",
                whatsapp: "WhatsApp",
                telegram: "Telegram",
                reddit: "Reddit",
                bluesky: "Bluesky",
                qr: "QR-Code der Karte",
                copy: "Link kopiert",
                direct: "Direkt",
              } as const)
            : locale === "it"
              ? ({
                  native: "Condivisione di sistema",
                  x: "X",
                  whatsapp: "WhatsApp",
                  telegram: "Telegram",
                  reddit: "Reddit",
                  bluesky: "Bluesky",
                  qr: "QR della scheda",
                  copy: "Link copiato",
                  direct: "Diretto",
                } as const)
              : ({
      native: "System share",
      x: "X",
      whatsapp: "WhatsApp",
      telegram: "Telegram",
      reddit: "Reddit",
      bluesky: "Bluesky",
      qr: "Share-card QR",
      copy: "Copied link",
      direct: "Direct",
                } as const);
  return labels[source];
}

export function shareComparisonHook(
  percentile: number | null | undefined,
  locale: ShareLocale = "en",
) {
  if (
    typeof percentile !== "number" ||
    !Number.isFinite(percentile) ||
    percentile < 70
  )
    return null;
  const value = Math.max(0, Math.min(100, Math.round(percentile)));
  if (locale === "zh") return `今日领先 ${value}% 玩家`;
  if (locale === "es") return `Superaste al ${value}% de jugadores hoy`;
  if (locale === "fr") return `Tu devances ${value}% des joueurs aujourd’hui`;
  if (locale === "de") return `Heute besser als ${value}% der Spieler`;
  if (locale === "it") return `Hai superato il ${value}% dei giocatori oggi`;
  return `Beat ${value}% of players today`;
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
