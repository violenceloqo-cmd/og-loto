"use client";
import { useEffect } from "react";
import { MIN_TOKEN_HOLDING_UI, PAYOUT_SOL, TOKEN_TICKER } from "../../lib/lotto/constants";

type Tier = {
  mc: string;
  payout: string;
  accent: string;
  badge: string;
};

const TIERS: Tier[] = [
  { mc: "Launch → 50K", payout: "1 SOL", accent: "bg-cream", badge: "bg-banana text-cherryDark" },
  { mc: "50K+", payout: "2 SOL", accent: "bg-banana/70", badge: "bg-cherry text-cream" },
  { mc: "80K+", payout: "3 SOL", accent: "bg-mine/20", badge: "bg-mine text-cream" },
  { mc: "120K+", payout: "4 SOL", accent: "bg-cherry/15", badge: "bg-cherry text-cream" },
  { mc: "200K+", payout: "10 SOL", accent: "bg-gold/40", badge: "bg-gold text-ink" },
];

export function RulesInfoModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 px-4 py-8 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border-4 border-ink bg-cream p-6 shadow-hardLg"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border-4 border-ink bg-cherry font-display text-lg text-cream shadow-hardSm transition-transform hover:rotate-90"
        >
          ×
        </button>

        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-full border-4 border-ink bg-banana px-3 py-1 font-display text-sm text-cherryDark shadow-hardSm">
            ★ RULES & INFO ★
          </div>
        </div>

        <h2 className="font-display text-3xl text-cherry text-stroke-black leading-none tracking-wide">
          HOW $LOTTO WORKS
        </h2>

        <div className="mt-5 space-y-5 text-sm font-medium text-cherryDark">
          <section className="rounded-xl border-4 border-ink bg-banana p-4 shadow-hardSm">
            <h3 className="mb-2 font-display text-lg text-cherry tracking-wide">THE BASICS</h3>
            <ol className="list-decimal space-y-1.5 pl-5">
              <li>
                Hold at least <b>{MIN_TOKEN_HOLDING_UI.toLocaleString()} ${TOKEN_TICKER}</b> in a Solana
                wallet.
              </li>
              <li>Tap any available number on the 100-number board.</li>
              <li>Paste the holding wallet to claim it — no fee, no deposit, no signature.</li>
              <li>
                Every <b>5 minutes</b> a new round draws <b>5 winning numbers</b> from a Solana
                blockhash (provably random).
              </li>
              <li>Winners are paid <b>instantly</b>, straight to their wallet.</li>
            </ol>
          </section>

          <section className="rounded-xl border-4 border-ink bg-cream p-4 shadow-hardSm">
            <h3 className="mb-1 font-display text-lg text-cherry tracking-wide">
              WHERE DO THE PAYOUTS COME FROM?
            </h3>
            <p className="leading-relaxed">
              Payouts are funded <b>100% from creator rewards</b>. There is no entry fee, no deposit,
              and no rake — every SOL paid out comes directly from the token's creator-reward stream.
            </p>
            <p className="mt-2 leading-relaxed">
              At launch, <b>1 SOL</b> is paid out every 5 minutes (split across the round's 5 winning
              numbers). As the token grows, payouts scale up at fixed market-cap milestones:
            </p>
          </section>

          <section>
            <h3 className="mb-2 font-display text-lg text-cherry tracking-wide">
              PAYOUT TIERS (PER 5-MIN ROUND)
            </h3>
            <div className="overflow-hidden rounded-xl border-4 border-ink shadow-hardSm">
              <div className="grid grid-cols-[1fr_auto] items-center gap-2 border-b-4 border-ink bg-ink px-4 py-2 font-display text-sm tracking-wider text-cream">
                <span>MARKET CAP</span>
                <span>PAYOUT / ROUND</span>
              </div>
              {TIERS.map((t, i) => (
                <div
                  key={t.mc}
                  className={`grid grid-cols-[1fr_auto] items-center gap-2 px-4 py-3 ${t.accent} ${
                    i !== TIERS.length - 1 ? "border-b-2 border-ink/30" : ""
                  }`}
                >
                  <span className="font-display text-base tracking-wide text-cherryDark">{t.mc}</span>
                  <span
                    className={`rounded-md border-2 border-ink px-2.5 py-1 font-display text-sm shadow-hardSm ${t.badge}`}
                  >
                    {t.payout}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs leading-relaxed text-cherryDark/80">
              Tiers unlock automatically once the token's market cap crosses the threshold. The
              higher the MC, the bigger the prize pool — every single round, forever.
            </p>
          </section>

          <section className="rounded-xl border-4 border-ink bg-mine p-4 text-cream shadow-hardSm">
            <h3 className="mb-1 font-display text-lg tracking-wide">FAIR PLAY</h3>
            <ul className="list-disc space-y-1 pl-5">
              <li>One number per wallet per round.</li>
              <li>Numbers are first-come, first-served.</li>
              <li>Winning numbers are derived from a public Solana blockhash — fully verifiable.</li>
              <li>If you sell below {MIN_TOKEN_HOLDING_UI.toLocaleString()} ${TOKEN_TICKER} before the draw, your pick is voided.</li>
            </ul>
          </section>

          <p className="pt-1 text-center font-display text-xs tracking-widest text-cherryDark">
            ★ HOLD ${TOKEN_TICKER} ★ PICK A NUMBER ★ WIN SOL ★ EVERY 5 MINUTES ★
          </p>
        </div>
      </div>
    </div>
  );
}
