"use client";
import { useRef, useState } from "react";
import { useRealtime } from "../providers/RealtimeProvider";
import { MIN_TOKEN_HOLDING_UI, PAYOUT_SOL, TOKEN_TICKER } from "../../lib/lotto/constants";

interface Props {
  n: number;
  onClose: () => void;
}

type Step = "form" | "reserved" | "error";

interface ReserveResponse {
  ok?: boolean;
  error?: string;
  ui_amount?: number;
  required?: number;
}

function fmtAmount(x: number | undefined): string {
  if (typeof x !== "number" || !Number.isFinite(x)) return "0";
  return x.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function errorMessage(json: ReserveResponse): string {
  switch (json.error) {
    case "insufficient_holding":
      return `This wallet only holds ${fmtAmount(json.ui_amount)} $${TOKEN_TICKER}. You need at least ${MIN_TOKEN_HOLDING_UI.toLocaleString()} to enter.`;
    case "wallet_already_picked":
      return "This wallet already reserved a number this round. One pick per wallet per round.";
    case "already_taken":
      return "Someone grabbed that number a split-second before you. Pick another.";
    case "round_closing":
      return "Too late — this round is wrapping up. Hang tight for the next one.";
    case "round_not_active":
      return "Round isn't accepting picks right now.";
    case "bad_holding_wallet":
      return "That doesn't look like a valid Solana address.";
    case "holding_check_failed":
      return "Couldn't read your token balance from Solana. Try again in a moment.";
    case "turnstile_failed":
      return "Bot check failed. Refresh and try again.";
    default:
      return json.error ?? "Something went wrong. Try again.";
  }
}

export function ReservationModal({ n, onClose }: Props) {
  const { round, rememberMine } = useRealtime();
  const [holdingWallet, setHoldingWallet] = useState("");
  const [step, setStep] = useState<Step>("form");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submittedRef = useRef(false);

  async function submit() {
    if (!round || submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/reserve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          round_id: round.id,
          n,
          holding_wallet: holdingWallet.trim(),
          turnstile_token: "",
        }),
      });
      const json = (await res.json()) as ReserveResponse;
      if (!res.ok || !json.ok) {
        setError(errorMessage(json));
        setStep("error");
        submittedRef.current = false;
        return;
      }
      rememberMine(round.id, n);
      setStep("reserved");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStep("error");
      submittedRef.current = false;
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-abyss/80 p-4 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="glass-strong w-full max-w-md rounded-3xl p-6 shadow-glassLg sm:p-7"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-full ring-2 ring-gold/50 shadow-glowGold">
              <span
                aria-hidden
                className="absolute inset-0 bg-[url('/ansem-coin.png')] bg-cover bg-center"
              />
              <span aria-hidden className="absolute inset-0 bg-abyss/30" />
              <span className="relative z-10 font-display text-xl font-extrabold text-white [text-shadow:_0_1px_3px_rgb(0_0_0_/_0.9)]">
                {n}
              </span>
            </span>
            <h2 className="font-display text-xl font-bold tracking-tight text-frost">
              Claim your bull
            </h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-lg text-mist transition-colors hover:bg-white/[0.1] hover:text-frost"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {step === "form" && (
          <>
            <p className="mb-4 text-sm leading-relaxed text-mist">
              Paste the Solana wallet that holds at least{" "}
              <span className="font-semibold text-aqua">
                {MIN_TOKEN_HOLDING_UI.toLocaleString()} ${TOKEN_TICKER}
              </span>
              . We&apos;ll send your{" "}
              <span className="font-semibold text-gold">{PAYOUT_SOL} SOL</span> winnings to this
              same wallet if your bull charges out of the pit.
            </p>
            <label className="mb-1.5 block font-display text-[11px] font-medium uppercase tracking-wider text-mist">
              Holding wallet
            </label>
            <input
              value={holdingWallet}
              onChange={(e) => setHoldingWallet(e.target.value)}
              className="mb-4 w-full rounded-xl border border-white/10 bg-abyss/60 px-3.5 py-3 font-mono text-sm text-frost outline-none transition-colors placeholder:text-mist/40 focus:border-aqua/50 focus:shadow-glowAqua"
              placeholder="Your Solana address…"
              spellCheck={false}
              autoCapitalize="none"
              autoCorrect="off"
            />
            <button
              onClick={submit}
              disabled={holdingWallet.trim().length < 30 || !round || submitting}
              className="w-full rounded-xl bg-accent-gradient py-3.5 font-display text-base font-bold tracking-tight text-abyss shadow-glowAqua transition-all hover:opacity-90 hover:shadow-glowIris disabled:opacity-35 disabled:shadow-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-aqua"
            >
              {submitting ? "Checking…" : "Claim bull"}
            </button>
            {!round && (
              <p className="mt-3 text-center text-xs text-mist">
                Waiting for the next round to spin up…
              </p>
            )}
            <p className="mt-3 text-center text-[11px] text-mist/70">
              One bull per wallet per round. No fees, no deposit — just hold the bag.
            </p>
          </>
        )}

        {step === "reserved" && (
          <>
            <div className="mb-4 flex justify-center">
              <span className="flex h-16 w-16 animate-float items-center justify-center rounded-full bg-mint/15 text-3xl shadow-glowMint">
                🐂
              </span>
            </div>
            <p className="mb-1 text-center font-display text-2xl font-bold tracking-tight text-frost">
              Bull #{n} is yours
            </p>
            <p className="mb-5 text-center text-sm leading-relaxed text-mist">
              Good luck — the stampede happens when the timer hits zero. If your bull charges,{" "}
              {PAYOUT_SOL} SOL lands in your wallet automatically.
            </p>
            <button
              onClick={onClose}
              className="w-full rounded-xl bg-mint py-3.5 font-display text-base font-bold tracking-tight text-abyss shadow-glowMint transition-opacity hover:opacity-90"
            >
              Let&apos;s go
            </button>
          </>
        )}

        {step === "error" && (
          <>
            <p className="mb-5 rounded-xl border border-coral/25 bg-coral/[0.08] px-4 py-3 text-sm leading-relaxed text-coral">
              {error}
            </p>
            <div className="flex gap-2.5">
              <button
                onClick={() => {
                  setError(null);
                  setStep("form");
                }}
                className="flex-1 rounded-xl bg-accent-gradient py-3 font-display text-sm font-bold text-abyss transition-opacity hover:opacity-90"
              >
                Try again
              </button>
              <button
                onClick={onClose}
                className="flex-1 rounded-xl border border-white/10 bg-white/[0.05] py-3 font-display text-sm font-medium text-frost transition-colors hover:bg-white/[0.1]"
              >
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
