"use client";
import { useEffect, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { useRealtime } from "../providers/RealtimeProvider";
import { PAYOUT_SOL, RESERVATION_SOL } from "../../lib/lotto/constants";

interface Props {
  n: number;
  onClose: () => void;
}

type Step = "form" | "awaiting" | "reserved" | "error";

export function ReservationModal({ n, onClose }: Props) {
  const { round, numbers, myNumbers, rememberMine } = useRealtime();
  const [payoutWallet, setPayoutWallet] = useState("");
  const [step, setStep] = useState<Step>("form");
  const [deposit, setDeposit] = useState<string | null>(null);
  const [pendingUntil, setPendingUntil] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const submittedRef = useRef(false);

  useEffect(() => {
    if (step !== "awaiting") return;
    const row = numbers.find((x) => x.n === n);

    if (row?.status === "reserved") {
      if (round) rememberMine(round.id, n);
      setStep("reserved");
      return;
    }

    // Trust pending_until from /api/reserve until it passes. Realtime can briefly
    // still show "available" before the pending update arrives — that is not expiry.
    const stillValid =
      !!pendingUntil && Date.now() < new Date(pendingUntil).getTime();
    if (stillValid) return;

    setError("Reservation expired before payment. Please try again.");
    setStep("error");
  }, [numbers, n, step, round, rememberMine, pendingUntil]);

  async function submit() {
    if (!round || submittedRef.current) return;
    submittedRef.current = true;
    setError(null);
    try {
      const res = await fetch("/api/reserve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          round_id: round.id,
          n,
          payout_wallet: payoutWallet.trim(),
          turnstile_token: "",
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string; deposit_address?: string; pending_until?: string };
      if (!res.ok || !json.ok) {
        setError(json.error ?? "reservation failed");
        setStep("error");
        submittedRef.current = false;
        return;
      }
      setDeposit(json.deposit_address ?? null);
      setPendingUntil(json.pending_until ?? null);
      setStep("awaiting");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStep("error");
      submittedRef.current = false;
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
                Drop the Solana wallet where you want your{" "}
                <span className="font-display text-cherry">{PAYOUT_SOL} SOL</span> winnings sent.
                You&apos;ll get a one-time deposit address for{" "}
                <span className="font-display">{RESERVATION_SOL} SOL</span>.
              </p>
              <label className="mb-1 block font-display text-xs tracking-widest text-cherry">
                ★ PAYOUT WALLET ★
              </label>
              <input
                value={payoutWallet}
                onChange={(e) => setPayoutWallet(e.target.value)}
                className="mb-4 w-full rounded-lg border-4 border-ink bg-white px-3 py-2 font-mono text-sm text-cherryDark outline-none placeholder:text-cherryDark/40 focus:border-cherry"
                placeholder="Your Solana address…"
              />
              <button
                onClick={submit}
                disabled={payoutWallet.trim().length < 30 || !round}
                className="w-full rounded-xl border-4 border-ink bg-cherry py-3 font-display text-xl tracking-wider text-cream shadow-hardSm transition-transform hover:-translate-y-0.5 hover:bg-cherryDark disabled:bg-cherry/40 disabled:shadow-none disabled:hover:translate-y-0"
              >
                ★ CONTINUE ★
              </button>
              {!round && (
                <p className="mt-3 text-center text-xs font-medium text-cherryDark/70">
                  Waiting for the next round to spin up…
                </p>
              )}
            </>
          )}

          {step === "awaiting" && deposit && (
            <>
              <p className="mb-3 text-sm font-medium">
                Send exactly{" "}
                <span className="font-display text-cherry">{RESERVATION_SOL} SOL</span> to the address
                below from any Solana wallet.
                Reservation expires at{" "}
                <span className="font-mono font-bold">
                  {new Date(pendingUntil ?? Date.now()).toLocaleTimeString()}
                </span>
                .
              </p>
              <div className="mb-4 flex justify-center rounded-xl border-4 border-ink bg-white p-3">
                <QRCodeCanvas value={`solana:${deposit}?amount=${RESERVATION_SOL}`} size={180} />
              </div>
              <div className="mb-3">
                <label className="mb-1 block font-display text-xs tracking-widest text-cherry">
                  ★ DEPOSIT ADDRESS ★
                </label>
                <div className="flex items-stretch gap-2">
                  <code className="flex-1 break-all rounded-lg border-2 border-ink bg-white p-2 font-mono text-xs text-cherryDark">
                    {deposit}
                  </code>
                  <button
                    onClick={() => navigator.clipboard.writeText(deposit)}
                    className="rounded-lg border-2 border-ink bg-banana px-3 font-display text-xs text-cherryDark shadow-hardSm hover:bg-sunshine"
                  >
                    COPY
                  </button>
                </div>
              </div>
              <p className="text-center font-display text-xs tracking-widest text-cherry animate-pulse">
                ★ WAITING FOR PAYMENT ★
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
                Good luck — drawing happens when the timer hits zero. 🍀
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
              <button
                onClick={onClose}
                className="w-full rounded-xl border-4 border-ink bg-banana py-3 font-display text-xl tracking-wider text-cherryDark shadow-hardSm hover:-translate-y-0.5"
              >
                CLOSE
              </button>
            </>
          )}

          {myNumbers.size >= 5 && step === "form" && (
            <p className="mt-3 text-center text-xs font-medium text-cherry">
              ⚠ You already have 5 numbers this round. Extra payments will be refunded.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
