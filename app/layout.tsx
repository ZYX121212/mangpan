import type { Metadata, Viewport } from "next";
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

const siteUrl = "https://mangpan-kline-game.hiayun.chatgpt.site";
const gameStructuredData = {
  "@context": "https://schema.org",
  "@type": ["VideoGame", "WebApplication"],
  name: "Blind Trading",
  url: siteUrl,
  image: `${siteUrl}/og.png`,
  description:
    "A free daily market-reading game built from real historical candlestick charts. The ticker, date, and future stay hidden until the reveal.",
  applicationCategory: "GameApplication",
  operatingSystem: "Any",
  browserRequirements: "Requires JavaScript and an HTML5-capable browser.",
  gamePlatform: "Web browser",
  genre: ["Strategy", "Simulation", "Educational"],
  playMode: ["SinglePlayer", "MultiPlayer"],
  inLanguage: ["en", "zh-CN"],
  isAccessibleForFree: true,
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  featureList: [
    "One shared daily market puzzle",
    "Endless practice on real historical charts",
    "Focused market-reading lessons",
    "Spoiler-free friend duels",
    "Private crew streaks",
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL("https://mangpan-kline-game.hiayun.chatgpt.site"),
  applicationName: "Blind Trading",
  category: "games",
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
    url: "/",
    siteName: "Blind Trading",
    locale: "en_US",
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
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Blind Trading",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      {
        url: "/icons/favicon-32.png",
        sizes: "32x32",
        type: "image/png",
      },
    ],
    shortcut: "/icons/favicon-32.png",
    apple: [
      {
        url: "/icons/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#252721",
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(gameStructuredData).replaceAll("<", "\\u003c"),
          }}
        />
        {children}
      </body>
    </html>
  );
}
