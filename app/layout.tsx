import "./globals.css";
import type { Metadata } from "next";
import { Space_Grotesk, Inter } from "next/font/google";
import { MIN_TOKEN_HOLDING_UI, PAYOUT_SOL, TOKEN_TICKER } from "../lib/lotto/constants";

const display = Space_Grotesk({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const body = Inter({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "BULLOTTO — Ansem's Provably Fair Solana Bull Lottery",
  description: `Run with the bulls. Live Solana lottery — 5-minute rounds, 100 Ansem bulls, hold ${MIN_TOKEN_HOLDING_UI.toLocaleString()} $${TOKEN_TICKER} to charge, ${PAYOUT_SOL} SOL per winning bull.`,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
