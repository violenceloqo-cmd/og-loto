"use client";
import { useEffect, useState } from "react";
import { useRealtime } from "../providers/RealtimeProvider";

function fmt(ms: number) {
  if (ms < 0) ms = 0;
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function RoundTimer() {
  const { round } = useRealtime();
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((x) => x + 1), 500);
    return () => clearInterval(id);
  }, []);

  const remaining = round ? new Date(round.ends_at).getTime() - Date.now() : 0;
  const timeUp = !!round && round.status === "active" && remaining <= 0;

  const label = !round
    ? "WAITING…"
    : round.status === "active"
    ? remaining > 0
      ? fmt(remaining)
      : "TIME'S UP!"
    : round.status === "completed"
    ? "ROUND OVER"
    : "GET READY…";

  const urgent =
    (round?.status === "active" && remaining > 0 && remaining < 30_000) || timeUp;

  const sublabel = !round
    ? "FOR NEXT ROUND"
    : round.status === "completed"
    ? "WINNERS BELOW"
    : timeUp
    ? "DRAWING WINNERS"
    : "TIME LEFT";

  return (
    <div className="rounded-2xl border-4 border-ink bg-ink p-3 shadow-hardLg">
      <div className="rounded-xl border-2 border-banana bg-black/60 px-4 py-3 text-center">
        <div className="font-display text-xs tracking-widest text-banana">
          ★ {sublabel} ★
        </div>
        <div
          className={`font-display text-5xl sm:text-6xl tabular-nums tracking-wider ${
            urgent ? "text-cherry animate-pulse" : "text-banana"
          }`}
          style={{ textShadow: "0 0 12px rgba(252,211,77,0.65), 0 0 22px rgba(220,38,38,0.4)" }}
        >
          {label}
        </div>
      </div>
    </div>
  );
}
