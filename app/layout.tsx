import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./order-estimate.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://mangpan-kline-game.hiayun.chatgpt.site"),
  title: "盲盘｜真实历史 K 线交易挑战",
  description: "在不知道股票身份与日期的情况下，用真实历史 K 线完成一场交易挑战。",
  openGraph: {
    title: "盲盘｜真实历史 K 线交易挑战",
    description: "只看走势，不看答案。用真实历史 K 线完成一场交易挑战。",
    type: "website",
    images: [{ url: "/og.png", width: 1672, height: 941, alt: "盲盘｜真实历史 K 线交易挑战" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "盲盘｜真实历史 K 线交易挑战",
    description: "只看走势，不看答案。用真实历史 K 线完成一场交易挑战。",
    images: ["/og.png"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
