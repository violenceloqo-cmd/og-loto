"use client";
import { useRealtime, type PublicNumber } from "../providers/RealtimeProvider";
import { cn } from "../../lib/utils";

interface Props {
  onPick: (n: number) => void;
}

function classFor(num: PublicNumber, mine: boolean, isWinner: boolean): string {
  if (isWinner) return "bg-gold text-black ring-4 ring-cherry animate-pulse-gold border-cherryDark";
  if (mine && num.status === "reserved") return "bg-mine text-cream border-cherryDark";
  if (num.status === "reserved") return "bg-cherry text-cream cursor-not-allowed border-cherryDark";
  return "bg-cream text-cherryDark hover:bg-banana hover:-translate-y-0.5 border-cherryDark";
}

export function NumberGrid({ onPick }: Props) {
  const { numbers, myNumbers, round } = useRealtime();
  const winners = new Set(round?.winning_numbers ?? []);
  // Picking requires a real round in "upcoming" or "active" — completed rounds
  // (and any legacy drawing/settling rows) keep the grid locked.
  const canPick = !!round && (round.status === "upcoming" || round.status === "active");

  // Always render 100 slots so the grid layout is visible. If the DB hasn't
  // returned rows yet (no round, or fetch in flight) fall back to a disabled
  // placeholder for that slot — preserves the visual without faking state.
  const byN = new Map(numbers.map((num) => [num.n, num]));
  const slots = Array.from({ length: 100 }, (_, i) => {
    const n = i + 1;
    return byN.get(n) ?? null;
  });

  return (
    <div className="grid grid-cols-10 gap-1.5 sm:gap-2">
      {slots.map((num, i) => {
        const n = i + 1;
        if (!num) {
          return (
            <button
              key={n}
              type="button"
              disabled
              className={cn(
                "aspect-square rounded-full border-2 font-display text-base sm:text-lg font-bold tracking-wider",
                "flex items-center justify-center",
                "bg-cream/40 text-cherryDark/50 border-cherryDark/40 cursor-not-allowed"
              )}
              title="Waiting for the next round to start…"
            >
              {n}
            </button>
          );
        }
        const mine = myNumbers.has(num.n);
        const isWinner = winners.has(num.n);
        const taken = num.status !== "available";
        const disabled = taken || !canPick;
        return (
          <button
            key={num.n}
            type="button"
            disabled={disabled}
            onClick={() => onPick(num.n)}
            className={cn(
              "aspect-square rounded-full border-2 font-display text-base sm:text-lg font-bold tracking-wider transition-all shadow-hardSm",
              "flex items-center justify-center",
              classFor(num, mine, isWinner),
              disabled && "opacity-90 shadow-none"
            )}
          >
            {num.n}
          </button>
        );
      })}
    </div>
  );
}
