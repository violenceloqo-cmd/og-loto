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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border-4 border-ink bg-stripes p-3 shadow-hardLg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="rounded-xl border-4 border-ink bg-cream p-6 text-cherryDark">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-ink bg-gold font-display text-2xl text-cherryDark shadow-hardSm">
                {n}
              </span>
              <h2 className="font-display text-2xl text-cherry tracking-wide">RESERVE!</h2>
            </div>
            <button
              onClick={onClose}
              className="font-display text-2xl text-cherry hover:text-ink"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          {step === "form" && (
            <>
              <p className="mb-3 text-sm font-medium text-cherryDark">
                Paste the Solana wallet that holds at least{" "}
                <span className="font-display text-cherry">
                  {MIN_TOKEN_HOLDING_UI.toLocaleString()} ${TOKEN_TICKER}
                </span>
                . We&apos;ll send your{" "}
                <span className="font-display text-cherry">{PAYOUT_SOL} SOL</span> winnings to this
                same wallet if your number gets drawn.
              </p>
              <label className="mb-1 block font-display text-xs tracking-widest text-cherry">
                ★ HOLDING WALLET ★
              </label>
              <input
                value={holdingWallet}
                onChange={(e) => setHoldingWallet(e.target.value)}
                className="mb-4 w-full rounded-lg border-4 border-ink bg-white px-3 py-2 font-mono text-sm text-cherryDark outline-none placeholder:text-cherryDark/40 focus:border-cherry"
                placeholder="Your Solana address…"
                spellCheck={false}
                autoCapitalize="none"
                autoCorrect="off"
              />
              <button
                onClick={submit}
                disabled={holdingWallet.trim().length < 30 || !round || submitting}
                className="w-full rounded-xl border-4 border-ink bg-cherry py-3 font-display text-xl tracking-wider text-cream shadow-hardSm transition-transform hover:-translate-y-0.5 hover:bg-cherryDark disabled:bg-cherry/40 disabled:shadow-none disabled:hover:translate-y-0"
              >
                {submitting ? "★ CHECKING… ★" : "★ CLAIM NUMBER ★"}
              </button>
              {!round && (
                <p className="mt-3 text-center text-xs font-medium text-cherryDark/70">
                  Waiting for the next round to spin up…
                </p>
              )}
              <p className="mt-3 text-center text-[11px] font-medium text-cherryDark/70">
                One pick per wallet per round. No fees, no deposit — just hold the bag.
              </p>
            </>
          )}

          {step === "reserved" && (
            <>
              <div className="mb-3 text-center text-6xl animate-wiggle">🎉</div>
              <p className="mb-1 text-center font-display text-2xl text-cherry">
                NUMBER #{n} IS YOURS!
              </p>
              <p className="mb-4 text-center text-sm font-medium text-cherryDark/80">
                Good luck — drawing happens when the timer hits zero. If you win, {PAYOUT_SOL} SOL
                lands in your wallet automatically. 🍀
              </p>
              <button
                onClick={onClose}
                className="w-full rounded-xl border-4 border-ink bg-mine py-3 font-display text-xl tracking-wider text-cream shadow-hardSm hover:-translate-y-0.5"
              >
                ★ LET&apos;S GO ★
              </button>
            </>
          )}

          {step === "error" && (
            <>
              <p className="mb-4 text-sm font-medium text-cherry">{error}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setError(null);
                    setStep("form");
                  }}
                  className="flex-1 rounded-xl border-4 border-ink bg-banana py-3 font-display text-lg tracking-wider text-cherryDark shadow-hardSm hover:-translate-y-0.5"
                >
                  TRY AGAIN
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 rounded-xl border-4 border-ink bg-cream py-3 font-display text-lg tracking-wider text-cherryDark shadow-hardSm hover:-translate-y-0.5"
                >
                  CLOSE
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
