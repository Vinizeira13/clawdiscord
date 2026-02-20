import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "ClawDiscord — AI-Powered Discord Server Setup in Seconds",
  description:
    "Stop building Discord servers manually. Our AI agent designs and deploys professional servers with categories, channels, roles, permissions, and embeds — all in seconds.",
  keywords: [
    "discord",
    "discord bot",
    "server setup",
    "ai agent",
    "discord automation",
    "clawdiscord",
  ],
  openGraph: {
    title: "ClawDiscord — AI-Powered Discord Server Setup",
    description:
      "An AI agent that designs and deploys complete Discord servers. Categories, channels, roles, permissions, embeds — automated.",
    url: "https://claw-discord.com",
    siteName: "ClawDiscord",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ClawDiscord — AI-Powered Discord Setup",
    description:
      "Stop building Discord servers manually. AI agent builds it in seconds.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#0a0a0f] text-white`}
      >
        {children}
      </body>
    </html>
  );
}
