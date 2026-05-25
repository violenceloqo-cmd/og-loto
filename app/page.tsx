"use client";
import { useState } from "react";
import Image from "next/image";
import { RealtimeProvider, useRealtime } from "../components/providers/RealtimeProvider";
import { NumberGrid } from "../components/ui/NumberGrid";
import { ReservationModal } from "../components/ui/ReservationModal";
import { RoundTimer } from "../components/ui/RoundTimer";
import { WinnersBanner } from "../components/ui/WinnersBanner";
import { ActivityFeed } from "../components/ui/ActivityFeed";
import { RulesInfoModal } from "../components/ui/RulesInfoModal";
import { LottoMachine2D } from "../components/scene/LottoMachine2D";
import { MIN_TOKEN_HOLDING_UI, PAYOUT_SOL, TOKEN_TICKER } from "../lib/lotto/constants";

function PageInner() {
  const { round, myNumbers, numbers } = useRealtime();
  const [picked, setPicked] = useState<number | null>(null);
  const [showRules, setShowRules] = useState(false);

  const reservedCount = numbers.filter((x) => x.status === "reserved").length;
  const hasPicked = myNumbers.size > 0;

  return (
    <>
      <div className="mx-auto max-w-7xl px-4 py-6">
        {/* Marquee header */}
        <header className="mb-6">
          <div className="relative rounded-2xl border-4 border-ink bg-stripes p-4 shadow-hardLg">
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border-4 border-ink bg-cream px-5 py-4">
              <div className="flex items-center gap-3">
                <Image
                  src="/logo.png"
                  alt="$LOTTO"
                  width={88}
                  height={88}
                  priority
                  className="h-16 w-16 sm:h-20 sm:w-20 animate-wiggle drop-shadow-[2px_2px_0_rgba(0,0,0,0.4)]"
                />
                <div>
                  <h1 className="font-display text-4xl sm:text-5xl text-cherry text-stroke-black tracking-wide leading-none">
                    $LOTTO
                  </h1>
                  <p className="mt-1 font-display text-sm text-cherryDark tracking-widest">
                    ★ HOLD {MIN_TOKEN_HOLDING_UI.toLocaleString()} ${TOKEN_TICKER} ★ PICK A NUMBER ★ PRIZEPOOL {PAYOUT_SOL} SOL ★
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => setShowRules(true)}
                  className="rounded-xl border-4 border-ink bg-cherry px-3 py-1 font-display text-sm text-cream shadow-hardSm transition-transform hover:-translate-y-0.5 hover:bg-cherryDark active:translate-y-0"
                >
                  ★ RULES & INFO
                </button>
                <div className="hidden sm:block rounded-xl border-4 border-ink bg-banana px-3 py-1 font-display text-sm text-cherryDark shadow-hardSm">
                  ROUND #{round?.id ?? "—"}
                </div>
                <div className="hidden sm:block rounded-xl border-4 border-ink bg-cream px-3 py-1 font-display text-sm text-cherryDark shadow-hardSm">
                  {reservedCount}/100 PICKED
                </div>
                <div className="hidden sm:block rounded-xl border-4 border-ink bg-mine px-3 py-1 font-display text-sm text-cream shadow-hardSm">
                  {hasPicked ? "✓ YOU'RE IN" : "PICK ONE"}
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
          {/* Lotto machine */}
          <div className="relative">
            <div className="absolute inset-x-6 -top-3 z-10 flex justify-center">
              <div className="rounded-full border-4 border-ink bg-banana px-6 py-1 font-display text-lg text-cherry shadow-hardSm animate-blink">
                ★ JACKPOT MACHINE ★
              </div>
            </div>
            <div className="relative h-[480px] overflow-hidden rounded-2xl border-4 border-ink bg-gradient-to-b from-cherryDark to-ink shadow-hardLg sm:h-[560px]">
              <LottoMachine2D />
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
              <a
                href="https://solana.com"
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-2 rounded-full border-4 border-ink bg-ink px-4 py-1.5 font-display text-xs tracking-widest text-cream shadow-hardSm transition-transform hover:-translate-y-0.5 active:translate-y-0"
              >
                <span
                  aria-hidden
                  className="inline-block h-3 w-3 rounded-full"
                  style={{
                    background:
                      "linear-gradient(135deg, #9945FF 0%, #14F195 100%)",
                  }}
                />
                POWERED BY SOLANA
              </a>
              <a
                href="https://pump.fun"
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-2 rounded-full border-4 border-ink bg-[#3FD17C] px-4 py-1.5 font-display text-xs tracking-widest text-ink shadow-hardSm transition-transform hover:-translate-y-0.5 active:translate-y-0"
              >
                <span aria-hidden className="text-base leading-none">💊</span>
                POWERED BY PUMP.FUN
              </a>
            </div>
            <div className="mt-4 lg:hidden">
              <RoundTimer />
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-4">
            <div className="hidden lg:block">
              <RoundTimer />
            </div>

            <WinnersBanner />

            <ActivityFeed />

            <div className="rounded-2xl border-4 border-ink bg-cream p-4 shadow-hardLg">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-display text-xl text-cherry tracking-wide">PICK A NUMBER</h2>
                <div className="rounded-md border-2 border-ink bg-banana px-2 py-0.5 font-display text-xs text-cherryDark">
                  HOLDERS ONLY
                </div>
              </div>
              <NumberGrid onPick={(n) => setPicked(n)} />
              <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-display tracking-wider text-cherryDark">
                <Legend color="bg-cream border-cherryDark" label="OPEN" />
                <Legend color="bg-cherry border-cherryDark" label="TAKEN" />
                <Legend color="bg-mine border-cherryDark" label="YOURS" />
                <Legend color="bg-gold border-cherryDark" label="WINNER!" />
              </div>
            </div>

          </div>
        </div>
      </div>

      {picked !== null && <ReservationModal n={picked} onClose={() => setPicked(null)} />}
      {showRules && <RulesInfoModal onClose={() => setShowRules(false)} />}
    </>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`inline-block h-3 w-3 rounded-full border-2 ${color}`} />
      <span>{label}</span>
    </div>
  );
}

export default function Page() {
  return (
    <RealtimeProvider>
      <PageInner />
    </RealtimeProvider>
  );
}
