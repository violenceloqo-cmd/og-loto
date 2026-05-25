"use client";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { sbBrowser } from "../../lib/supabase/browser";

export type NumberStatus = "available" | "reserved" | "expired";

export interface PublicNumber {
  id: number;
  round_id: number;
  n: number;
  status: NumberStatus;
  is_winner: boolean;
}

export interface RoundSummary {
  id: number;
  // 'drawing' and 'settling' are kept in the union for backward compatibility
  // with historical rows. New rounds only ever transition upcoming → active
  // → completed.
  status: "upcoming" | "active" | "drawing" | "settling" | "completed";
  starts_at: string;
  ends_at: string;
  winning_numbers: number[] | null;
  draw_blockhash: string | null;
}

export interface FeedEntry {
  number_id: number;
  round_id: number;
  n: number;
  status: string;
  is_winner: boolean;
  /** Holder/payout wallet — same address post-token-gating migration. */
  sender_wallet: string | null;
  reserved_at: string | null;
  payout_signature: string | null;
  payout_status: string | null;
}

interface Ctx {
  round: RoundSummary | null;
  numbers: PublicNumber[];
  /** Live activity feed for the current round (newest first). */
  feed: FeedEntry[];
  /** Local set of numbers the user has personally reserved (from localStorage). */
  myNumbers: Set<number>;
  rememberMine: (roundId: number, n: number) => void;
}

const RealtimeCtx = createContext<Ctx | null>(null);

const MY_KEY = (roundId: number) => `lotto:mine:${roundId}`;

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const [round, setRound] = useState<RoundSummary | null>(null);
  const [numbers, setNumbers] = useState<PublicNumber[]>([]);
  const [feed, setFeed] = useState<FeedEntry[]>([]);
  const [myNumbers, setMyNumbers] = useState<Set<number>>(new Set());

  // initial fetch of round + numbers
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/round/current", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as { round: RoundSummary | null };
        if (cancelled) return;
        if (!json.round) return;
        setRound(json.round);
        const { data: nums } = await sbBrowser()
          .from("public_numbers")
          .select("*")
          .eq("round_id", json.round.id)
          .order("n");
        if (cancelled) return;
        setNumbers((nums ?? []) as unknown as PublicNumber[]);
        try {
          const fr = await fetch("/api/feed", { cache: "no-store" });
          if (fr.ok) {
            const fj = (await fr.json()) as { current: { picks: FeedEntry[] } };
            if (!cancelled) setFeed(fj.current?.picks ?? []);
          }
        } catch {
          // feed is best-effort; ignore
        }
        const raw = typeof window !== "undefined" ? localStorage.getItem(MY_KEY(json.round.id)) : null;
        if (raw) {
          try { setMyNumbers(new Set(JSON.parse(raw))); } catch { /* ignore */ }
        } else {
          setMyNumbers(new Set());
        }
      } catch {
        // Backend unreachable — leave round null; UI will show "waiting" state.
      }
    }
    load();
    // Re-poll until a round shows up so the UI bootstraps as soon as the
    // backend cron creates one (no manual refresh needed).
    const bootInterval = setInterval(() => {
      if (!cancelled && !round) load();
    }, 5000);
    return () => { cancelled = true; clearInterval(bootInterval); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // realtime subscriptions
  useEffect(() => {
    if (!round) return;
    const supa = sbBrowser();
    const channel = supa
      .channel(`round-${round.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "numbers", filter: `round_id=eq.${round.id}` },
        (payload) => {
          const row = payload.new as (PublicNumber & {
            payout_wallet?: string | null;
            holding_wallet?: string | null;
            reserved_at?: string | null;
          }) | null;
          if (!row) return;
          setNumbers((prev) => {
            const safe: PublicNumber = {
              id: row.id,
              round_id: row.round_id,
              n: row.n,
              status: row.status,
              is_winner: row.is_winner ?? false,
            };
            const idx = prev.findIndex((p) => p.n === safe.n);
            if (idx === -1) return [...prev, safe].sort((a, b) => a.n - b.n);
            const next = prev.slice();
            next[idx] = safe;
            return next;
          });

          if (row.status === "reserved") {
            setFeed((prev) => {
              const entry: FeedEntry = {
                number_id: row.id,
                round_id: row.round_id,
                n: row.n,
                status: row.status,
                is_winner: row.is_winner ?? false,
                sender_wallet: row.payout_wallet ?? row.holding_wallet ?? null,
                reserved_at: row.reserved_at ?? null,
                payout_signature: prev.find((e) => e.n === row.n)?.payout_signature ?? null,
                payout_status: prev.find((e) => e.n === row.n)?.payout_status ?? null,
              };
              const idx = prev.findIndex((e) => e.n === row.n);
              const next = idx === -1 ? [entry, ...prev] : prev.slice();
              if (idx !== -1) next[idx] = { ...next[idx], ...entry };
              next.sort((a, b) => {
                const ta = a.reserved_at ? Date.parse(a.reserved_at) : 0;
                const tb = b.reserved_at ? Date.parse(b.reserved_at) : 0;
                return tb - ta;
              });
              return next;
            });
          } else {
            setFeed((prev) => prev.filter((e) => e.n !== row.n));
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "rounds", filter: `id=eq.${round.id}` },
        (payload) => {
          const r = payload.new as RoundSummary | null;
          if (r) setRound(r);
        }
      )
      .subscribe();

    // Poll faster once the round timer hits zero so winners + the next round
    // appear promptly (the active → completed flip happens on the next tick).
    const endsAtMs = new Date(round.ends_at).getTime();
    const aboutToFlip = round.status === "active" && Date.now() >= endsAtMs - 5_000;
    const pollMs = aboutToFlip ? 2000 : 10000;
    const interval = setInterval(async () => {
      let json: { round: RoundSummary | null } = { round: null };
      try {
        const res = await fetch("/api/round/current", { cache: "no-store" });
        if (!res.ok) return;
        json = (await res.json()) as { round: RoundSummary | null };
      } catch {
        return;
      }
      if (!json.round) return;

      const winnersChanged =
        JSON.stringify(json.round.winning_numbers) !==
        JSON.stringify(round.winning_numbers);
      const statusChanged = json.round.status !== round.status;

      if (json.round.id !== round.id) {
        setRound(json.round);
        const { data: nums } = await sbBrowser()
          .from("public_numbers")
          .select("*")
          .eq("round_id", json.round.id)
          .order("n");
        setNumbers((nums ?? []) as unknown as PublicNumber[]);
        setMyNumbers(new Set());
        try {
          const fr = await fetch("/api/feed", { cache: "no-store" });
          if (fr.ok) {
            const fj = (await fr.json()) as { current: { picks: FeedEntry[] } };
            setFeed(fj.current?.picks ?? []);
          }
        } catch {
          // ignore
        }
        return;
      }

      if (statusChanged || winnersChanged) {
        setRound(json.round);
      }

      // Refresh feed when status/winners changed, or while a freshly-completed
      // round is still draining payout signatures into the `payouts` table.
      const justCompleted =
        json.round.status === "completed" &&
        Date.now() - new Date(json.round.ends_at).getTime() < 60_000;
      if (statusChanged || winnersChanged || justCompleted) {
        try {
          const fr = await fetch("/api/feed", { cache: "no-store" });
          if (fr.ok) {
            const fj = (await fr.json()) as { current: { picks: FeedEntry[] } };
            setFeed(fj.current?.picks ?? []);
          }
        } catch {
          // ignore
        }
      }
    }, pollMs);

    return () => {
      supa.removeChannel(channel);
      clearInterval(interval);
    };
  }, [round?.id, round?.status]);

  const rememberMine = (roundId: number, n: number) => {
    if (!round || round.id !== roundId) return;
    setMyNumbers((prev) => {
      const next = new Set(prev);
      next.add(n);
      try { localStorage.setItem(MY_KEY(roundId), JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  };

  const value = useMemo<Ctx>(
    () => ({ round, numbers, feed, myNumbers, rememberMine }),
    [round, numbers, feed, myNumbers]
  );
  return <RealtimeCtx.Provider value={value}>{children}</RealtimeCtx.Provider>;
}

export function useRealtime(): Ctx {
  const v = useContext(RealtimeCtx);
  if (!v) throw new Error("useRealtime outside provider");
  return v;
}
