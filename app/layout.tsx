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
  title: "Blind Trading | Real Historical Market Challenge",
  description:
    "Trade real historical candlestick charts without seeing the ticker, date, or future price action. Practice decisions, risk, and execution.",
  keywords: [
    "stock trading game",
    "candlestick chart challenge",
    "trading simulator",
    "market training",
    "historical stock charts",
  ],
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  openGraph: {
    title: "Blind Trading | Can You Read the Market Better?",
    description:
      "One hidden historical chart. Five decisions. Challenge friends on the exact same market without seeing the ticker or future.",
    type: "website",
    images: [
      {
        url: "/og.png",
        width: 1672,
        height: 941,
        alt: "Blind Trading — Trade the setup, not the ticker",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Blind Trading | Can You Read the Market Better?",
    description:
      "One hidden historical chart. Five decisions. Challenge a friend on the exact same market.",
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
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
