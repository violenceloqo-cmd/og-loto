"use client";
import { useEffect, useState } from "react";
import { useRealtime, type FeedEntry } from "../providers/RealtimeProvider";
import { solscanAddr, solscanTx, shortAddr, shortSig } from "../../lib/solscan";
import { cn } from "../../lib/utils";

const CLUSTER = (process.env.NEXT_PUBLIC_SOLANA_CLUSTER ?? "mainnet-beta") as
  | "mainnet-beta"
  | "devnet"
  | "testnet";

interface PastRound {
  id: number;
  status: string;
  ends_at: string;
  winning_numbers: number[] | null;
  draw_blockhash: string | null;
  picks: FeedEntry[];
}

type Tab = "current" | "past";

export function ActivityFeed() {
  const { feed, round } = useRealtime();
  const [tab, setTab] = useState<Tab>("current");
  const [past, setPast] = useState<PastRound[]>([]);
  const [pastLoading, setPastLoading] = useState(false);

  useEffect(() => {
    if (tab !== "past") return;
    let cancelled = false;
    setPastLoading(true);
    (async () => {
      try {
        const r = await fetch("/api/feed", { cache: "no-store" });
        if (!r.ok) return;
        const j = (await r.json()) as { past: PastRound[] };
        if (!cancelled) setPast(j.past ?? []);
      } catch {
        // ignore
      } finally {
        if (!cancelled) setPastLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, round?.id]);

  return (
    <div className="rounded-2xl border-4 border-ink bg-cream p-4 shadow-hardLg">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-xl text-cherry tracking-wide">ACTIVITY</h2>
        <div className="flex gap-1 rounded-md border-2 border-ink bg-banana p-0.5">
          <TabButton active={tab === "current"} onClick={() => setTab("current")}>
            CURRENT
          </TabButton>
          <TabButton active={tab === "past"} onClick={() => setTab("past")}>
            PAST ROUNDS
          </TabButton>
        </div>
      </div>

      {tab === "current" ? (
        <CurrentTab feed={feed} />
      ) : (
        <PastTab past={past} loading={pastLoading} />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-2 py-0.5 font-display text-xs tracking-wider transition-colors rounded",
        active
          ? "bg-cherry text-cream shadow-hardSm"
          : "text-cherryDark hover:bg-cream/60"
      )}
    >
      {children}
    </button>
  );
}

function CurrentTab({ feed }: { feed: FeedEntry[] }) {
  if (feed.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-cherryDark/40 bg-cream/60 px-3 py-6 text-center font-display text-xs tracking-widest text-cherryDark/70">
        ★ NO PICKS YET — BE THE FIRST ★
      </div>
    );
  }
  // Winners first, then newest reservations.
  const sorted = feed.slice().sort((a, b) => {
    if (a.is_winner !== b.is_winner) return a.is_winner ? -1 : 1;
    const ta = a.reserved_at ? Date.parse(a.reserved_at) : 0;
    const tb = b.reserved_at ? Date.parse(b.reserved_at) : 0;
    return tb - ta;
  });
  return (
    <ul className="max-h-80 space-y-1.5 overflow-y-auto pr-1">
      {sorted.map((e) => (
        <FeedRow key={e.number_id} entry={e} />
      ))}
    </ul>
  );
}

function PastTab({ past, loading }: { past: PastRound[]; loading: boolean }) {
  if (loading && past.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-cherryDark/40 bg-cream/60 px-3 py-6 text-center font-display text-xs tracking-widest text-cherryDark/70">
        LOADING…
      </div>
    );
  }
  if (past.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-cherryDark/40 bg-cream/60 px-3 py-6 text-center font-display text-xs tracking-widest text-cherryDark/70">
        ★ NO PAST ROUNDS WITH PICKS YET ★
      </div>
    );
  }
  return (
    <div className="max-h-96 space-y-3 overflow-y-auto pr-1">
      {past.map((r) => (
        <PastRoundGroup key={r.id} round={r} />
      ))}
    </div>
  );
}

function PastRoundGroup({ round }: { round: PastRound }) {
  const winnersSet = new Set(round.winning_numbers ?? []);
  const sorted = round.picks.slice().sort((a, b) => {
    const aw = winnersSet.has(a.n) || a.is_winner;
    const bw = winnersSet.has(b.n) || b.is_winner;
    if (aw !== bw) return aw ? -1 : 1;
    return a.n - b.n;
  });
  const winnerCount = sorted.filter((p) => winnersSet.has(p.n) || p.is_winner).length;
  return (
    <div className="rounded-xl border-2 border-ink bg-cream/60">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-ink bg-banana px-3 py-1.5">
        <div className="font-display text-sm text-cherryDark tracking-wide">
          ROUND #{round.id}
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded border-2 border-ink bg-lime/80 px-1.5 py-0.5 font-display text-[10px] text-ink tracking-wider">
            {winnerCount} WINNERS
          </span>
          {round.draw_blockhash && (
            <a
              href={solscanAddr(round.draw_blockhash, CLUSTER)}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded border-2 border-ink bg-cream px-1.5 py-0.5 font-display text-[10px] text-cherryDark tracking-wider hover:bg-banana"
              title="Draw blockhash on Solscan"
            >
              SEED {shortSig(round.draw_blockhash)} ↗
            </a>
          )}
        </div>
      </div>
      <ul className="space-y-1.5 p-2">
        {sorted.map((e) => {
          const isWinner = winnersSet.has(e.n) || e.is_winner;
          return <FeedRow key={e.number_id} entry={{ ...e, is_winner: isWinner }} />;
        })}
      </ul>
    </div>
  );
}

function FeedRow({ entry }: { entry: FeedEntry }) {
  const winner = entry.is_winner;
  return (
    <li
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-lg border-2 px-2 py-1.5 text-xs",
        winner
          ? "border-ink bg-lime/40 border-l-[6px] border-l-lime shadow-hardSm"
          : "border-cherryDark/30 bg-cream/80"
      )}
    >
      <span
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 font-display text-sm",
          winner
            ? "border-ink bg-gold text-cherryDark"
            : "border-cherryDark bg-cream text-cherryDark"
        )}
      >
        {entry.n}
      </span>

      {entry.sender_wallet ? (
        <a
          href={solscanAddr(entry.sender_wallet, CLUSTER)}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-[11px] text-cherryDark underline decoration-dotted underline-offset-2 hover:text-cherry"
          title={entry.sender_wallet}
        >
          {shortAddr(entry.sender_wallet)}
        </a>
      ) : (
        <span className="font-mono text-[11px] text-cherryDark/60">unknown</span>
      )}

      <div className="ml-auto flex flex-wrap items-center gap-1.5">
        {entry.deposit_signature && (
          <a
            href={solscanTx(entry.deposit_signature, CLUSTER)}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded border-2 border-cherryDark/60 bg-cream px-1.5 py-0.5 font-display text-[10px] text-cherryDark tracking-wider hover:bg-banana"
            title="Reservation tx on Solscan"
          >
            BET ↗
          </a>
        )}
        {winner && entry.payout_signature && (
          <a
            href={solscanTx(entry.payout_signature, CLUSTER)}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded border-2 border-ink bg-lime px-1.5 py-0.5 font-display text-[10px] text-ink tracking-wider shadow-hardSm hover:bg-lime/80"
            title="Payout tx on Solscan"
          >
            WON +0.1 SOL ↗
          </a>
        )}
        {winner && !entry.payout_signature && (
          <span
            className="rounded border-2 border-ink bg-lime/60 px-1.5 py-0.5 font-display text-[10px] text-ink tracking-wider"
            title="Payout pending"
          >
            WINNER
          </span>
        )}
      </div>
    </li>
  );
}
