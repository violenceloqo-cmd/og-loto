// Drives round transitions. Called every minute by /api/cron/tick.
//
//   upcoming → active     (when starts_at reached)
//   active   → completed  (when ends_at reached; reads current finalized
//                          blockhash, computes 5 winners, queues payouts,
//                          creates next round — all in the same tick)
//
// Under the token-gated model there are no deposits / webhooks / sweeps /
// refunds — reservations are atomic at /api/reserve. The state machine is
// therefore intentionally tiny: lifecycle + payout draining.
import "server-only";
import { sb } from "../supabase/server";
import { connection } from "../solana/connection";
import { drawWinningNumbers, WINNERS_PER_ROUND } from "../solana/randomness";
import { activateRound, createRound } from "./bootstrap";
import { processPayouts } from "../payouts/process";
import { PAYOUT_LAMPORTS } from "../lotto/constants";

/** Any round whose ends_at is older than this and isn't completed is
 *  considered zombied (RPC outage / missed cron tick around the draw) and
 *  is force-completed. Belt-and-suspenders. */
const ROUND_STUCK_AFTER_MS = 15 * 60 * 1000;
/** After a round completes, give the UI time to drop all winning balls into
 *  their pedestals (~5s) and let players see the winners (~13s extra) before
 *  the next round becomes active. */
export const REVEAL_DELAY_MS = 18 * 1000;

type RoundStatus = "upcoming" | "active" | "completed";

type Round = {
  id: number;
  status: RoundStatus;
  starts_at: string;
  ends_at: string;
  draw_blockhash: string | null;
  winning_numbers: number[] | null;
};

/** Any non-completed status. Legacy 'drawing'/'settling' rows from the old
 *  state machine are still recognized for cleanup. */
const LIVE_STATUSES = ["upcoming", "active", "drawing", "settling"] as const;

async function loadRound(id: number): Promise<Round | null> {
  const { data } = await sb().from("rounds").select("*").eq("id", id).maybeSingle();
  return (data as Round | null) ?? null;
}

async function loadCurrentRound(): Promise<Round | null> {
  const { data } = await sb()
    .from("rounds")
    .select("*")
    .in("status", LIVE_STATUSES as unknown as string[])
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as Round | null) ?? null;
}

async function ensureUpcomingRound(): Promise<bigint> {
  const existing = await loadCurrentRound();
  if (existing) return BigInt(existing.id);
  return createRound({ startsAt: new Date() });
}

/** Collapse duplicate non-completed rounds down to one. */
async function dedupeLiveRounds(): Promise<string[]> {
  const { data: live } = await sb()
    .from("rounds")
    .select("id, status")
    .in("status", LIVE_STATUSES as unknown as string[])
    .order("id", { ascending: true });
  if (!live || live.length <= 1) return [];

  const priority = (s: string) =>
    s === "settling" ? 4 : s === "drawing" ? 3 : s === "active" ? 2 : 1;
  const keeper = live.slice().sort((a, b) => {
    const pa = priority(a.status as string);
    const pb = priority(b.status as string);
    if (pa !== pb) return pb - pa;
    return (b.id as number) - (a.id as number);
  })[0];

  const actions: string[] = [];
  for (const r of live) {
    if (r.id === keeper.id) continue;
    await sb()
      .from("rounds")
      .update({ status: "completed" })
      .eq("id", r.id as number);
    actions.push(`deduped duplicate round ${r.id} (was ${r.status})`);
  }
  return actions;
}

/** Force-complete any round whose ends_at is older than ROUND_STUCK_AFTER_MS. */
async function reapStuckRounds(): Promise<string[]> {
  const cutoff = new Date(Date.now() - ROUND_STUCK_AFTER_MS).toISOString();
  const { data: stuck } = await sb()
    .from("rounds")
    .select("id, status")
    .in("status", LIVE_STATUSES as unknown as string[])
    .lt("ends_at", cutoff);
  if (!stuck || stuck.length === 0) return [];
  const actions: string[] = [];
  for (const r of stuck) {
    await sb()
      .from("rounds")
      .update({ status: "completed" })
      .eq("id", r.id as number);
    actions.push(`reaped stuck round ${r.id} (was ${r.status})`);
  }
  return actions;
}

/** Fetch the most recent finalized blockhash from Solana. Seeds the draw. */
async function currentFinalizedBlockhash(): Promise<string> {
  const { blockhash } = await connection().getLatestBlockhash("finalized");
  if (!blockhash) throw new Error("getLatestBlockhash returned empty hash");
  return blockhash;
}

let tickInFlight: Promise<{ actions: string[] }> | null = null;

export async function tick(): Promise<{ actions: string[] }> {
  if (tickInFlight) return tickInFlight;
  tickInFlight = (async () => {
    try {
      return await runTick();
    } finally {
      tickInFlight = null;
    }
  })();
  return tickInFlight;
}

async function runTick(): Promise<{ actions: string[] }> {
  const actions: string[] = [];

  const reaped = await reapStuckRounds();
  actions.push(...reaped);

  const deduped = await dedupeLiveRounds();
  actions.push(...deduped);

  const roundId = await ensureUpcomingRound();
  let round = await loadRound(Number(roundId));
  if (!round) return { actions };
  const now = new Date();

  // upcoming → active
  if (round.status === "upcoming" && now >= new Date(round.starts_at)) {
    await activateRound(BigInt(round.id));
    actions.push(`round ${round.id} → active`);
    round = await loadRound(round.id);
    if (!round) return { actions };
  }

  // active → completed
  if (round.status === "active" && now >= new Date(round.ends_at)) {
    const blockhash = await currentFinalizedBlockhash();
    const winners = drawWinningNumbers(blockhash, WINNERS_PER_ROUND);

    const { error: roundUpdErr } = await sb()
      .from("rounds")
      .update({
        status: "completed",
        draw_blockhash: blockhash,
        winning_numbers: winners,
      })
      .eq("id", round.id);
    if (roundUpdErr) {
      throw new Error(
        `complete-round update failed: ${roundUpdErr.message}. ` +
          `If this mentions winning_numbers, your DB schema is out of date — ` +
          `wipe and re-run supabase/migrations/0001_init.sql.`
      );
    }

    await sb()
      .from("numbers")
      .update({ is_winner: true })
      .eq("round_id", round.id)
      .in("n", winners);

    const { data: winRows } = await sb()
      .from("numbers")
      .select("id, payout_wallet")
      .eq("round_id", round.id)
      .eq("is_winner", true)
      .eq("status", "reserved");
    if (winRows && winRows.length > 0) {
      const payoutRows = winRows
        .filter((r) => !!r.payout_wallet)
        .map((r) => ({
          round_id: round!.id,
          number_id: r.id,
          payout_wallet: r.payout_wallet as string,
          amount_lamports: PAYOUT_LAMPORTS,
          status: "pending" as const,
        }));
      if (payoutRows.length > 0) {
        await sb().from("payouts").insert(payoutRows);
      }
    }

    actions.push(`round ${round.id} → completed, winners ${winners.join(",")}`);
    const nextStartsAt = new Date(Date.now() + REVEAL_DELAY_MS);
    await createRound({ startsAt: nextStartsAt });
    actions.push(`new round queued (starts in ${Math.round(REVEAL_DELAY_MS / 1000)}s)`);
  }

  // Drain pending payouts every tick regardless of round status.
  const p = await processPayouts({ maxPerTick: 10 });
  if (p.sent) actions.push(`paid ${p.sent}`);

  return { actions };
}
