import type { MetadataRoute } from "next";

const siteUrl = "https://mangpan-kline-game.hiayun.chatgpt.site";
const canonicalRoutes = [
  "",
  "/daily",
  "/quick-read",
  "/endless",
  "/practice",
  "/training",
  "/duel",
  "/crew",
  "/run",
  "/privacy",
  "/terms",
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  return canonicalRoutes.map((route) => ({ url: `${siteUrl}${route}` }));
}
