"use client";
import { useState } from "react";
import { RealtimeProvider, useRealtime } from "../components/providers/RealtimeProvider";
import { NumberGrid } from "../components/ui/NumberGrid";
import { ReservationModal } from "../components/ui/ReservationModal";
import { RoundTimer } from "../components/ui/RoundTimer";
import { WinnersBanner } from "../components/ui/WinnersBanner";
import { ActivityFeed } from "../components/ui/ActivityFeed";
import { LottoMachine2D } from "../components/scene/LottoMachine2D";
import { PAYOUT_SOL, RESERVATION_SOL } from "../lib/lotto/constants";

function PageInner() {
  const { round, myNumbers, numbers } = useRealtime();
  const [picked, setPicked] = useState<number | null>(null);

  const reservedCount = numbers.filter((x) => x.status === "reserved").length;
  const myCount = myNumbers.size;

  return (
    <>
      <div className="mx-auto max-w-7xl px-4 py-6">
        {/* Marquee header */}
        <header className="mb-6">
          <div className="relative rounded-2xl border-4 border-ink bg-stripes p-4 shadow-hardLg">
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border-4 border-ink bg-cream px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="text-4xl animate-wiggle">🎰</span>
                <div>
                  <h1 className="font-display text-4xl sm:text-5xl text-cherry text-stroke-black tracking-wide leading-none">
                    LOTTO COIN
                  </h1>
                  <p className="mt-1 font-display text-sm text-cherryDark tracking-widest">
                    ★ PICK YOUR LUCKY NUMBER ★ {RESERVATION_SOL} SOL ★ WIN {PAYOUT_SOL} SOL ★
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="hidden sm:block rounded-xl border-4 border-ink bg-banana px-3 py-1 font-display text-sm text-cherryDark shadow-hardSm">
                  ROUND #{round?.id ?? "—"}
                </div>
                <div className="hidden sm:block rounded-xl border-4 border-ink bg-cream px-3 py-1 font-display text-sm text-cherryDark shadow-hardSm">
                  {reservedCount}/100 PICKED
                </div>
                <div className="hidden sm:block rounded-xl border-4 border-ink bg-mine px-3 py-1 font-display text-sm text-cream shadow-hardSm">
                  {myCount}/5 YOURS
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
            {/* mobile timer */}
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
                  {RESERVATION_SOL} SOL EACH
                </div>
              </div>
              <NumberGrid onPick={(n) => setPicked(n)} />
              <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-display tracking-wider text-cherryDark">
                <Legend color="bg-cream border-cherryDark" label="OPEN" />
                <Legend color="bg-sunshine border-cherryDark" label="PENDING" />
                <Legend color="bg-cherry border-cherryDark" label="TAKEN" />
                <Legend color="bg-mine border-cherryDark" label="YOURS" />
                <Legend color="bg-gold border-cherryDark" label="WINNER!" />
              </div>
            </div>

            <div className="rounded-2xl border-4 border-ink bg-banana p-4 shadow-hardLg">
              <div className="mb-2 font-display text-lg text-cherry tracking-wide">HOW IT WORKS</div>
              <ol className="list-decimal space-y-1 pl-5 text-sm font-medium text-cherryDark">
                <li>Tap an available number.</li>
                <li>Paste the wallet for your winnings.</li>
                <li>Send {RESERVATION_SOL} SOL to the deposit address.</li>
                <li>9 winners drawn from a Solana blockhash.</li>
                <li>Each winning number pays {PAYOUT_SOL} SOL automatically.</li>
              </ol>
            </div>
          </div>
        </div>

        <footer className="mt-8 flex justify-center">
          <div className="rounded-full border-2 border-ink bg-cream/40 px-4 py-1 font-display text-xs text-cream tracking-widest">
            ★ FEELING LUCKY? ★ SPIN TO WIN ★ 🍀
          </div>
        </footer>
      </div>

      {picked !== null && <ReservationModal n={picked} onClose={() => setPicked(null)} />}
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
