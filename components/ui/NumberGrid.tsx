"use client";
import { useRealtime, type PublicNumber } from "../providers/RealtimeProvider";
import { cn } from "../../lib/utils";

interface Props {
  onPick: (n: number) => void;
}

function classFor(num: PublicNumber, mine: boolean, isWinner: boolean): string {
  if (isWinner)
    return "bg-gold-gradient text-abyss font-bold shadow-glowGold animate-pulse-gold border-transparent";
  if (mine && num.status === "reserved")
    return "bg-mint/20 text-mint border-mint/40 shadow-glowMint";
  if (num.status === "reserved")
    return "bg-iris/15 text-iris/80 border-iris/25 cursor-not-allowed";
  return "bg-white/[0.04] text-frost/80 border-white/10 hover:bg-aqua/15 hover:text-aqua hover:border-aqua/40 hover:shadow-glowAqua hover:-translate-y-0.5";
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
                "aspect-square rounded-xl border font-display text-sm sm:text-base font-medium",
                "flex items-center justify-center",
                "bg-white/[0.02] text-mist/40 border-white/[0.05] cursor-not-allowed"
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
              "aspect-square rounded-xl border font-display text-sm sm:text-base font-medium transition-all duration-150",
              "flex items-center justify-center",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-aqua",
              classFor(num, mine, isWinner),
              disabled && !isWinner && !mine && "opacity-70"
            )}
          >
            {num.n}
          </button>
        );
      })}
    </div>
  );
}
