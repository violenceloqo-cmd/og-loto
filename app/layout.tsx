import "./globals.css";
import type { Metadata } from "next";
import { Luckiest_Guy, Fredoka } from "next/font/google";
import { MIN_TOKEN_HOLDING_UI, PAYOUT_SOL, TOKEN_TICKER } from "../lib/lotto/constants";

const display = Luckiest_Guy({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const body = Fredoka({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "$LOTTO — Pick Your Lucky Number!",
  description: `Live Solana lottery — 5-minute rounds, 100 numbers, hold ${MIN_TOKEN_HOLDING_UI.toLocaleString()} $${TOKEN_TICKER} to play, ${PAYOUT_SOL} SOL per winning number.`,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
