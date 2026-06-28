"use client";
import { useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { RealtimeProvider, useRealtime } from "../components/providers/RealtimeProvider";
import { NumberGrid } from "../components/ui/NumberGrid";
import { ReservationModal } from "../components/ui/ReservationModal";
import { RoundTimer } from "../components/ui/RoundTimer";
import { WinnersBanner } from "../components/ui/WinnersBanner";
import { ActivityFeed } from "../components/ui/ActivityFeed";
import { RulesInfoModal } from "../components/ui/RulesInfoModal";
import { LottoMachine2D } from "../components/scene/LottoMachine2D";
import { ContractAddress } from "../components/ui/ContractAddress";
import { MIN_TOKEN_HOLDING_UI, PAYOUT_SOL, TOKEN_TICKER } from "../lib/lotto/constants";

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
};

function PageInner() {
  const { round, myNumbers, numbers } = useRealtime();
  const [picked, setPicked] = useState<number | null>(null);
  const [showRules, setShowRules] = useState(false);

  const reservedCount = numbers.filter((x) => x.status === "reserved").length;
  const hasPicked = myNumbers.size > 0;

  return (
    <>
      {/* Sticky glass nav */}
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-abyss/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="BULLOTTO"
              width={44}
              height={44}
              priority
              className="h-11 w-11 rounded-full"
            />
            <span className="font-display text-xl font-bold tracking-tight text-frost">
              BULL<span className="text-accent-gradient">OTTO</span>
            </span>
            <span className="hidden rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-0.5 font-display text-[11px] font-medium tracking-wide text-mist md:inline">
              Solana bull lottery · every 5 min
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <ContractAddress />
            <button
              type="button"
              onClick={() => setShowRules(true)}
              className="rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 font-display text-sm font-medium text-frost transition-colors hover:bg-white/[0.12] focus-visible:outline focus-visible:outline-2 focus-visible:outline-aqua"
            >
              How it works
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
        {/* Hero */}
        <motion.section
          {...fadeUp}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="pb-8 pt-10 sm:pt-14"
        >
          <div className="grid items-center gap-8 lg:grid-cols-[1.15fr_0.85fr]">
            <div>
              <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-aqua/20 bg-aqua/[0.07] px-3 py-1 font-display text-xs font-medium tracking-wide text-aqua">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-aqua opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-aqua" />
                </span>
                Round #{round?.id ?? "—"} live · bull market is on
              </p>
              <h1 className="font-display text-4xl font-bold leading-[1.02] tracking-tight text-frost sm:text-6xl">
                Run with
                <br />
                the bulls.
                <br />
                <span className="text-accent-gradient">Win SOL.</span>
              </h1>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-mist sm:text-base">
                Hold {MIN_TOKEN_HOLDING_UI.toLocaleString()} ${TOKEN_TICKER}, claim one of 100 Ansem
                bulls, and win {PAYOUT_SOL} SOL when your bull charges out of the pit. Provably fair,
                drawn from a Solana blockhash every 5 minutes.
              </p>

              {/* Stat cluster */}
              <div className="mt-7 flex flex-wrap gap-3">
                <StatCard label="Prize / bull" value={`${PAYOUT_SOL} SOL`} accent="gold" />
                <StatCard label="Bulls taken" value={`${reservedCount}/100`} accent="aqua" />
                <StatCard
                  label="Your status"
                  value={hasPicked ? "Charging" : "Sidelined"}
                  accent={hasPicked ? "mint" : "neutral"}
                />
              </div>
            </div>

            {/* Ansem bull portrait */}
            <div className="relative mx-auto w-full max-w-sm">
              <div
                aria-hidden
                className="pointer-events-none absolute -inset-6 rounded-[2.5rem] bg-accent-gradient-soft blur-2xl"
              />
              <div className="glass-strong relative overflow-hidden rounded-[2rem] p-2 shadow-glassLg">
                <Image
                  src="/ansem.png"
                  alt="Ansem — the Bullotto bull"
                  width={640}
                  height={640}
                  priority
                  className="h-auto w-full rounded-[1.6rem]"
                />
                <div className="pointer-events-none absolute inset-0 rounded-[1.6rem] ring-1 ring-inset ring-white/10" />
                <div className="absolute bottom-4 left-4 rounded-full border border-gold/30 bg-abyss/60 px-3 py-1 font-display text-xs font-semibold tracking-wide text-gold backdrop-blur-md">
                  ANSEM · the bull
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        <WinnersBanner />

        {/* Main grid — board left, machine + timer right */}
        <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <motion.div
            {...fadeUp}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-6"
          >
            <div className="glass rounded-3xl p-5 shadow-glass sm:p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold tracking-tight text-frost">
                  The pit
                </h2>
                <span className="rounded-full border border-iris/25 bg-iris/10 px-2.5 py-0.5 font-display text-[11px] font-medium tracking-wide text-iris">
                  Holders only
                </span>
              </div>
              <NumberGrid onPick={(n) => setPicked(n)} />
              <div className="mt-4 flex flex-wrap gap-4 text-xs text-mist">
                <Legend dot="bg-white/15 ring-1 ring-white/25" label="Open" />
                <Legend dot="bg-iris/70" label="Taken" />
                <Legend dot="bg-mint" label="Yours" />
                <Legend dot="bg-gold" label="Winner" />
              </div>
            </div>

            <ActivityFeed />
          </motion.div>

          <motion.div
            {...fadeUp}
            transition={{ duration: 0.6, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-6"
          >
            <RoundTimer />

            <div className="glass relative overflow-hidden rounded-3xl shadow-glass">
              <div className="absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-full border border-white/10 bg-abyss/60 px-4 py-1 font-display text-xs font-medium tracking-wide text-mist backdrop-blur-md">
                The arena
              </div>
              <div className="h-[420px] sm:h-[480px]">
                <LottoMachine2D />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <a
                href="https://solana.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 font-display text-xs font-medium tracking-wide text-mist transition-colors hover:bg-white/[0.09] hover:text-frost"
              >
                <span
                  aria-hidden
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ background: "linear-gradient(135deg, #9945FF 0%, #14F195 100%)" }}
                />
                Powered by Solana
              </a>
              <a
                href="https://pump.fun"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 font-display text-xs font-medium tracking-wide text-mist transition-colors hover:bg-white/[0.09] hover:text-frost"
              >
                <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full bg-[#3FD17C]" />
                Powered by pump.fun
              </a>
            </div>
          </motion.div>
        </div>
      </div>

      {picked !== null && <ReservationModal n={picked} onClose={() => setPicked(null)} />}
      {showRules && <RulesInfoModal onClose={() => setShowRules(false)} />}
    </>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: "gold" | "aqua" | "mint" | "neutral";
}) {
  const valueClass =
    accent === "gold"
      ? "text-gold-gradient"
      : accent === "aqua"
      ? "text-aqua"
      : accent === "mint"
      ? "text-mint"
      : "text-frost";
  return (
    <div className="glass min-w-[120px] rounded-2xl px-4 py-3 shadow-glass">
      <div className="font-display text-[11px] font-medium uppercase tracking-wider text-mist">
        {label}
      </div>
      <div className={`mt-1 font-display text-xl font-bold tracking-tight ${valueClass}`}>
        {value}
      </div>
    </div>
  );
}

function Legend({ dot, label }: { dot: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`inline-block h-2.5 w-2.5 rounded-full ${dot}`} />
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
