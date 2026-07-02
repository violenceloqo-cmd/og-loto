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
        Round #{round.id} winners
      </div>
      <div className="mt-3 flex flex-wrap gap-2.5">
        {round.winning_numbers.map((n) => (
          <span
            key={n}
            className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gold-gradient font-display text-xl font-bold text-abyss shadow-glowGold"
          >
            {n}
          </span>
        ))}
      </div>
    </div>
  );
}
