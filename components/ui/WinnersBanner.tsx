"use client";
import { useRealtime } from "../providers/RealtimeProvider";

export function WinnersBanner() {
  const { round } = useRealtime();
  if (!round?.winning_numbers || round.winning_numbers.length === 0) return null;
  return (
    <div className="rounded-2xl border-4 border-ink bg-gold p-3 shadow-hardLg animate-pulse-gold">
      <div className="rounded-xl border-2 border-ink bg-cream px-4 py-3">
        <div className="font-display text-sm tracking-widest text-cherry">
          ★ ROUND #{round.id} WINNERS ★
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {round.winning_numbers.map((n) => (
            <span
              key={n}
              className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-ink bg-gold font-display text-2xl text-cherryDark shadow-hardSm"
            >
              {n}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
