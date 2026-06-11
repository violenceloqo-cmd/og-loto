"use client";
import { useEffect, useState } from "react";
import { useRealtime, type FeedEntry } from "../providers/RealtimeProvider";
import { solscanAddr, solscanTx, shortAddr, shortSig } from "../../lib/solscan";
import { cn } from "../../lib/utils";
import { PAYOUT_SOL } from "../../lib/lotto/constants";

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
    <div className="glass rounded-3xl p-5 shadow-glass sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold tracking-tight text-frost">Activity</h2>
        <div className="flex gap-1 rounded-full border border-white/10 bg-white/[0.04] p-1">
          <TabButton active={tab === "current"} onClick={() => setTab("current")}>
            Current
          </TabButton>
          <TabButton active={tab === "past"} onClick={() => setTab("past")}>
            Past rounds
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
        "rounded-full px-3 py-1 font-display text-xs font-medium transition-colors",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-aqua",
        active
          ? "bg-accent-gradient text-abyss"
          : "text-mist hover:text-frost"
      )}
    >
      {children}
    </button>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-8 text-center font-display text-xs font-medium tracking-wide text-mist">
      {children}
    </div>
  );
}

function CurrentTab({ feed }: { feed: FeedEntry[] }) {
  if (feed.length === 0) {
    return <EmptyState>No picks yet — be the first</EmptyState>;
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
    return <EmptyState>Loading…</EmptyState>;
  }
  if (past.length === 0) {
    return <EmptyState>No past rounds with picks yet</EmptyState>;
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
    <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.02]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.07] bg-white/[0.03] px-3 py-2">
        <div className="font-display text-sm font-semibold text-frost">Round #{round.id}</div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-mint/25 bg-mint/10 px-2 py-0.5 font-display text-[10px] font-medium tracking-wide text-mint">
            {winnerCount} winners
          </span>
          {round.draw_blockhash && (
            <a
              href={solscanAddr(round.draw_blockhash, CLUSTER)}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 font-mono text-[10px] text-mist transition-colors hover:text-frost"
              title="Draw blockhash on Solscan"
            >
              seed {shortSig(round.draw_blockhash)} ↗
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
        "flex flex-wrap items-center gap-2.5 rounded-xl border px-2.5 py-2 text-xs",
        winner
          ? "border-gold/25 bg-gold/[0.06]"
          : "border-white/[0.06] bg-white/[0.02]"
      )}
    >
      <span
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg font-display text-sm font-semibold",
          winner
            ? "bg-gold-gradient text-abyss"
            : "border border-white/10 bg-white/[0.04] text-frost/80"
        )}
      >
        {entry.n}
      </span>

      {entry.sender_wallet ? (
        <a
          href={solscanAddr(entry.sender_wallet, CLUSTER)}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-[11px] text-mist underline decoration-white/20 decoration-dotted underline-offset-2 transition-colors hover:text-aqua"
          title={entry.sender_wallet}
        >
          {shortAddr(entry.sender_wallet)}
        </a>
      ) : (
        <span className="font-mono text-[11px] text-mist/50">unknown</span>
      )}

      <div className="ml-auto flex flex-wrap items-center gap-1.5">
        {!winner && (
          <span
            className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 font-display text-[10px] font-medium tracking-wide text-mist"
            title="Token-holder pick"
          >
            Holder
          </span>
        )}
        {winner && entry.payout_signature && (
          <a
            href={solscanTx(entry.payout_signature, CLUSTER)}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-gold-gradient px-2.5 py-0.5 font-display text-[10px] font-bold tracking-wide text-abyss transition-opacity hover:opacity-85"
            title="Payout tx on Solscan"
          >
            Won +{PAYOUT_SOL} SOL ↗
          </a>
        )}
        {winner && !entry.payout_signature && (
          <span
            className="rounded-full border border-gold/30 bg-gold/10 px-2.5 py-0.5 font-display text-[10px] font-medium tracking-wide text-gold"
            title="Payout pending"
          >
            Winner
          </span>
        )}
      </div>
    </li>
  );
}
