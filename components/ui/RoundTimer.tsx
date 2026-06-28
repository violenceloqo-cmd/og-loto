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
    ? "Waiting…"
    : round.status === "active"
    ? remaining > 0
      ? fmt(remaining)
      : "Time's up"
    : round.status === "completed"
    ? "Round over"
    : "Get ready…";

  const urgent =
    (round?.status === "active" && remaining > 0 && remaining < 30_000) || timeUp;

  const sublabel = !round
    ? "Next round"
    : round.status === "completed"
    ? "Charging bulls below"
    : timeUp
    ? "Releasing the bulls"
    : "Time left";

  // Progress ring fraction (only meaningful while active).
  const total =
    round && round.status === "active"
      ? new Date(round.ends_at).getTime() - new Date(round.starts_at).getTime()
      : 0;
  const frac = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0;

  return (
    <div className="glass relative overflow-hidden rounded-3xl p-6 shadow-glass">
      {/* shimmer accent along the top edge */}
      <div className="shimmer-line absolute inset-x-0 top-0 h-px animate-shimmer" aria-hidden />
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="font-display text-[11px] font-medium uppercase tracking-wider text-mist">
            {sublabel}
          </div>
          <div
            className={`mt-1 font-display text-5xl font-bold tabular-nums tracking-tight sm:text-6xl ${
              urgent ? "animate-pulse text-coral" : "text-frost"
            }`}
          >
            {label}
          </div>
        </div>
        {/* progress ring */}
        <svg viewBox="0 0 80 80" className="h-20 w-20 shrink-0 -rotate-90" aria-hidden>
          <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="6" />
          <circle
            cx="40"
            cy="40"
            r="34"
            fill="none"
            stroke={urgent ? "#fb7185" : "url(#timer-grad)"}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${frac * 213.6} 213.6`}
            className="transition-[stroke-dasharray] duration-500"
          />
          <defs>
            <linearGradient id="timer-grad" x1="0" y1="0" x2="80" y2="80" gradientUnits="userSpaceOnUse">
              <stop stopColor="#2fd576" />
              <stop offset="1" stopColor="#f5b13d" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </div>
  );
}
