"use client";
import { useRealtime, type PublicNumber } from "../providers/RealtimeProvider";
import { cn } from "../../lib/utils";

interface Props {
  onPick: (n: number) => void;
}

interface Look {
  tint: string;
  ring: string;
  num: string;
  extra?: string;
}

function lookFor(num: PublicNumber, mine: boolean, isWinner: boolean): Look {
  if (isWinner)
    return {
      tint: "bg-gold/45",
      ring: "ring-gold shadow-glowGold animate-pulse-gold",
      num: "text-white",
    };
  if (mine && num.status === "reserved")
    return {
      tint: "bg-mint/40",
      ring: "ring-mint shadow-glowMint",
      num: "text-white",
    };
  if (num.status === "reserved")
    return {
      tint: "bg-abyss/65 saturate-50",
      ring: "ring-iris/40",
      num: "text-white/70",
      extra: "cursor-not-allowed",
    };
  return {
    tint: "bg-abyss/45 group-hover:bg-abyss/15",
    ring: "ring-white/15 group-hover:ring-aqua/70 group-hover:shadow-glowAqua",
    num: "text-white",
    extra: "group-hover:-translate-y-0.5",
  };
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
    <div className="grid grid-cols-10 gap-1.5 sm:gap-2.5">
      {slots.map((num, i) => {
        const n = i + 1;
        if (!num) {
          return (
            <button
              key={n}
              type="button"
              disabled
              title="Waiting for the next round to start…"
              className="group relative aspect-square overflow-hidden rounded-full ring-2 ring-white/10 cursor-not-allowed"
            >
              <span
                aria-hidden
                className="absolute inset-0 bg-[url('/ansem-coin.png')] bg-cover bg-center opacity-40 saturate-0"
              />
              <span aria-hidden className="absolute inset-0 bg-abyss/70" />
              <span className="relative z-10 flex h-full w-full items-center justify-center font-display text-base font-extrabold text-white/40 sm:text-lg">
                {n}
              </span>
            </button>
          );
        }
        const mine = myNumbers.has(num.n);
        const isWinner = winners.has(num.n);
        const taken = num.status !== "available";
        const disabled = taken || !canPick;
        const look = lookFor(num, mine, isWinner);
        return (
          <button
            key={num.n}
            type="button"
            disabled={disabled}
            onClick={() => onPick(num.n)}
            title={`Ansem bull #${num.n}`}
            className={cn(
              "group relative aspect-square overflow-hidden rounded-full ring-2 transition-all duration-150",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-aqua",
              look.ring,
              look.extra
            )}
          >
            <span
              aria-hidden
              className="absolute inset-0 bg-[url('/ansem-coin.png')] bg-cover bg-center"
            />
            <span aria-hidden className={cn("absolute inset-0 transition-colors", look.tint)} />
            <span
              className={cn(
                "relative z-10 flex h-full w-full items-center justify-center font-display text-base font-extrabold sm:text-lg",
                "[text-shadow:_0_1px_4px_rgb(0_0_0_/_0.9)]",
                look.num
              )}
            >
              {num.n}
            </span>
          </button>
        );
      })}
    </div>
  );
}
