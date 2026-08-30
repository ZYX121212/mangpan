import type { MetadataRoute } from "next";

const siteUrl = "https://mangpan-kline-game.hiayun.chatgpt.site";
const canonicalRoutes = [
  "",
  "/daily",
  "/practice",
  "/training",
  "/duel",
  "/crew",
  "/privacy",
  "/terms",
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  return canonicalRoutes.map((route) => ({ url: `${siteUrl}${route}` }));
}
