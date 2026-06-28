"use client";
import { useRealtime } from "../providers/RealtimeProvider";

export function WinnersBanner() {
  const { round } = useRealtime();
  if (!round?.winning_numbers || round.winning_numbers.length === 0) return null;
  return (
    <div className="glass-strong relative mt-2 overflow-hidden rounded-3xl border-gold/30 p-5 shadow-glowGold">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-16 h-44 w-44 rounded-full bg-gold/15 blur-3xl"
      />
      <div className="font-display text-[11px] font-medium uppercase tracking-wider text-gold">
        Round #{round.id} charging bulls
      </div>
      <div className="mt-3 flex flex-wrap gap-2.5">
        {round.winning_numbers.map((n) => (
          <span
            key={n}
            className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-full ring-2 ring-gold shadow-glowGold"
          >
            <span
              aria-hidden
              className="absolute inset-0 bg-[url('/ansem-coin.png')] bg-cover bg-center"
            />
            <span aria-hidden className="absolute inset-0 bg-gold/45" />
            <span className="relative z-10 font-display text-xl font-extrabold text-white [text-shadow:_0_1px_4px_rgb(0_0_0_/_0.9)]">
              {n}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
