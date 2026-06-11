"use client";
import { useEffect } from "react";
import { MIN_TOKEN_HOLDING_UI, PAYOUT_SOL, TOKEN_TICKER } from "../../lib/lotto/constants";

type Tier = {
  mc: string;
  payout: string;
  badge: string;
};

const TIERS: Tier[] = [
  { mc: "Launch → 50K", payout: "1 SOL", badge: "border-white/15 bg-white/[0.06] text-frost" },
  { mc: "50K+", payout: "2 SOL", badge: "border-aqua/30 bg-aqua/10 text-aqua" },
  { mc: "80K+", payout: "3 SOL", badge: "border-mint/30 bg-mint/10 text-mint" },
  { mc: "120K+", payout: "4 SOL", badge: "border-iris/30 bg-iris/10 text-iris" },
  { mc: "200K+", payout: "10 SOL", badge: "border-gold/40 bg-gold/15 text-gold" },
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-abyss/80 px-4 py-8 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="glass-strong relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl p-6 shadow-glassLg sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-lg text-mist transition-colors hover:bg-white/[0.1] hover:text-frost"
        >
          ×
        </button>

        <span className="inline-block rounded-full border border-aqua/25 bg-aqua/[0.08] px-3 py-1 font-display text-xs font-medium tracking-wide text-aqua">
          Rules &amp; info
        </span>

        <h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-frost">
          How <span className="text-accent-gradient">LOTTO</span> works
        </h2>

        <div className="mt-6 space-y-5 text-sm leading-relaxed text-mist">
          <section className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5">
            <h3 className="mb-3 font-display text-base font-semibold text-frost">The basics</h3>
            <ol className="list-decimal space-y-2 pl-5">
              <li>
                Hold at least{" "}
                <b className="text-frost">
                  {MIN_TOKEN_HOLDING_UI.toLocaleString()} ${TOKEN_TICKER}
                </b>{" "}
                in a Solana wallet.
              </li>
              <li>Tap any available number on the 100-number board.</li>
              <li>Paste the holding wallet to claim it — no fee, no deposit, no signature.</li>
              <li>
                Every <b className="text-frost">5 minutes</b> a new round draws{" "}
                <b className="text-frost">5 winning numbers</b> from a Solana blockhash (provably
                random).
              </li>
              <li>
                Winners are paid <b className="text-frost">instantly</b>, straight to their wallet.
              </li>
            </ol>
          </section>

          <section className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5">
            <h3 className="mb-2 font-display text-base font-semibold text-frost">
              Where do the payouts come from?
            </h3>
            <p>
              Payouts are funded <b className="text-frost">100% from creator rewards</b>. There is
              no entry fee, no deposit, and no rake — every SOL paid out comes directly from the
              token&apos;s creator-reward stream.
            </p>
            <p className="mt-2">
              At launch, <b className="text-frost">1 SOL</b> is paid out every 5 minutes (split
              across the round&apos;s 5 winning numbers). As the token grows, payouts scale up at
              fixed market-cap milestones:
            </p>
          </section>

          <section>
            <h3 className="mb-3 font-display text-base font-semibold text-frost">
              Payout tiers (per 5-min round)
            </h3>
            <div className="overflow-hidden rounded-2xl border border-white/[0.08]">
              <div className="grid grid-cols-[1fr_auto] items-center gap-2 border-b border-white/[0.08] bg-white/[0.05] px-4 py-2.5 font-display text-xs font-medium uppercase tracking-wider text-mist">
                <span>Market cap</span>
                <span>Payout / round</span>
              </div>
              {TIERS.map((t, i) => (
                <div
                  key={t.mc}
                  className={`grid grid-cols-[1fr_auto] items-center gap-2 px-4 py-3 ${
                    i !== TIERS.length - 1 ? "border-b border-white/[0.05]" : ""
                  }`}
                >
                  <span className="font-display text-sm font-medium text-frost">{t.mc}</span>
                  <span
                    className={`rounded-full border px-3 py-1 font-display text-xs font-semibold ${t.badge}`}
                  >
                    {t.payout}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-mist/70">
              Tiers unlock automatically once the token&apos;s market cap crosses the threshold.
              The higher the MC, the bigger the prize pool — every single round, forever.
            </p>
          </section>

          <section className="rounded-2xl border border-mint/20 bg-mint/[0.05] p-5">
            <h3 className="mb-2 font-display text-base font-semibold text-mint">Fair play</h3>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>One number per wallet per round.</li>
              <li>Numbers are first-come, first-served.</li>
              <li>Winning numbers are derived from a public Solana blockhash — fully verifiable.</li>
              <li>
                If you sell below {MIN_TOKEN_HOLDING_UI.toLocaleString()} ${TOKEN_TICKER} before the
                draw, your pick is voided.
              </li>
            </ul>
          </section>

          <p className="pt-1 text-center font-display text-xs font-medium tracking-wide text-mist">
            Hold ${TOKEN_TICKER} · Pick a number · Win SOL · Every 5 minutes
          </p>
        </div>
      </div>
    </div>
  );
}
