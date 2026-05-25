// Drives round transitions. Called every minute by /api/cron/tick.
//
//   upcoming → active     (when starts_at reached)
//   active   → completed  (when ends_at reached; reads current finalized
//                          blockhash, computes winners, queues payouts/sweeps,
//                          tears down webhook, creates next round — all in
//                          the same tick, atomically from the user's POV)
//
// There is no `drawing` or `settling` intermediate state. The previous
// design committed a future Solana slot then waited ~20s for it to finalize
// before reading its blockhash. That window of "stuck" status was the source
// of every reliability bug we hit. Reading the *current* finalized blockhash
// at round-end is still on-chain provable randomness (anyone can re-derive
// winners from the published `draw_blockhash`) and removes the entire stuck-
// state failure mode.
import "server-only";
import { sb } from "../supabase/server";
import { connection } from "../solana/connection";
import { drawWinningNumbers, WINNERS_PER_ROUND } from "../solana/randomness";
import { activateRound, createRound } from "./bootstrap";
import { deleteHeliusWebhook, purgeOrphanWebhooks } from "../helius/webhooks";
import { processPayouts } from "../payouts/process";
import { processSweeps } from "../payouts/sweeps";
import { processRefunds } from "../payouts/refunds";
import { PAYOUT_LAMPORTS } from "../lotto/constants";
import { reconcilePendingDeposits } from "../payments/reconcile";

const PENDING_TTL_MS = 3 * 60 * 1000;
/** Any round whose ends_at is older than this and isn't completed is considered
 *  zombied (RPC outage / missed cron tick around the draw) and is force-completed.
 *  With the simpler state machine this is rarely needed, but kept as belt-and-suspenders. */
const ROUND_STUCK_AFTER_MS = 15 * 60 * 1000;

type RoundStatus = "upcoming" | "active" | "completed";

type Round = {
  id: number;
  status: RoundStatus;
  starts_at: string;
  ends_at: string;
  draw_blockhash: string | null;
  winning_numbers: number[] | null;
  helius_webhook_id: string | null;
};

/** Any non-completed status. We still query against legacy values like
 *  'drawing' / 'settling' so historical zombie rows from the old state
 *  machine still get cleaned up by reap/dedupe.  */
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

/** When concurrent ticks race to "create the next round" they can each insert
 *  a fresh upcoming row before any of them activates one. Result: multiple
 *  non-completed rounds → activateRound for any but the first hits
 *  one_live_round.  Force-complete every non-completed round except the
 *  one furthest along the lifecycle. */
async function dedupeLiveRounds(): Promise<string[]> {
  const { data: live } = await sb()
    .from("rounds")
    .select("id, status, helius_webhook_id")
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
    if (r.helius_webhook_id) {
      try {
        await deleteHeliusWebhook(r.helius_webhook_id as string);
      } catch (e) {
        void e;
      }
    }
    await sb()
      .from("rounds")
      .update({ status: "completed", helius_webhook_id: null })
      .eq("id", r.id as number);
    actions.push(`deduped duplicate round ${r.id} (was ${r.status})`);
  }
  return actions;
}

/** Force-complete any round whose ends_at is older than ROUND_STUCK_AFTER_MS
 *  and is still not 'completed'. Frees the one_live_round unique index after
 *  any partial-failure (RPC outage, crash mid-tick, etc). */
async function reapStuckRounds(): Promise<string[]> {
  const cutoff = new Date(Date.now() - ROUND_STUCK_AFTER_MS).toISOString();
  const { data: stuck } = await sb()
    .from("rounds")
    .select("id, status, helius_webhook_id")
    .in("status", LIVE_STATUSES as unknown as string[])
    .lt("ends_at", cutoff);
  if (!stuck || stuck.length === 0) return [];
  const actions: string[] = [];
  for (const r of stuck) {
    const id = r.id as number;
    if (r.helius_webhook_id) {
      try {
        await deleteHeliusWebhook(r.helius_webhook_id as string);
      } catch (e) {
        void e;
      }
    }
    await sb()
      .from("rounds")
      .update({ status: "completed", helius_webhook_id: null })
      .eq("id", id);
    actions.push(`reaped stuck round ${id} (was ${r.status})`);
  }
  return actions;
}

/** Expire pending reservations whose TTL has passed. */
async function expirePending(roundId: number): Promise<number> {
  const { data, error } = await sb()
    .from("numbers")
    .update({ status: "available", pending_until: null, payout_wallet: null })
    .eq("round_id", roundId)
    .eq("status", "pending")
    .lt("pending_until", new Date().toISOString())
    .select("id");
  if (error) throw new Error(`expirePending: ${error.message}`);
  return data?.length ?? 0;
}

/** Fetch the most recent finalized blockhash from Solana. Used as the seed
 *  for the deterministic winner draw. Players verify by reading the same
 *  blockhash off Solscan and re-running drawWinningNumbers. */
async function currentFinalizedBlockhash(): Promise<string> {
  const { blockhash } = await connection().getLatestBlockhash("finalized");
  if (!blockhash) throw new Error("getLatestBlockhash returned empty hash");
  return blockhash;
}

/** Single in-process mutex for tick(). Prevents the multiple paths that
 *  trigger ticks (Vercel cron, dev poll on /api/round/current, manual curl,
 *  realtime polling) from racing each other and producing duplicate rounds /
 *  duplicate Helius webhooks within the same Node process. */
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

  // Self-heal: auto-complete any round wedged past ends_at + 15min.
  const reaped = await reapStuckRounds();
  actions.push(...reaped);

  // Dedupe: collapse any duplicate non-completed rounds down to one.
  const deduped = await dedupeLiveRounds();
  actions.push(...deduped);

  // Make sure there's always exactly one live round.
  const roundId = await ensureUpcomingRound();
  let round = await loadRound(Number(roundId));
  if (!round) return { actions };
  const now = new Date();

  // upcoming → active
  if (round.status === "upcoming" && now >= new Date(round.starts_at)) {
    // Self-cleaning: before adding a new Helius webhook, purge any orphans
    // that aren't referenced by a live DB round. Prevents leaks (and the
    // 50-webhook account cap) after crashes, hot-reloads, or APP_URL changes.
    try {
      const { data: liveRounds } = await sb()
        .from("rounds")
        .select("helius_webhook_id")
        .in("status", LIVE_STATUSES as unknown as string[])
        .not("helius_webhook_id", "is", null);
      const keep = new Set<string>(
        (liveRounds ?? [])
          .map((r) => r.helius_webhook_id as string | null)
          .filter((x): x is string => !!x)
      );
      const purged = await purgeOrphanWebhooks(keep);
      if (purged > 0) actions.push(`purged ${purged} orphan webhook(s)`);
    } catch (e) {
      void e;
    }
    await activateRound(BigInt(round.id));
    actions.push(`round ${round.id} → active`);
    round = await loadRound(round.id);
    if (!round) return { actions };
  }

  // While active: pending TTL cleanup + deposit reconciliation.
  if (round.status === "active") {
    const expired = await expirePending(round.id);
    if (expired > 0) actions.push(`expired ${expired} pending`);
    const confirmed = await reconcilePendingDeposits(round.id);
    if (confirmed > 0) actions.push(`confirmed ${confirmed} deposit(s)`);
  }

  // active → completed (single atomic step)
  //
  // When the round's ends_at has passed:
  //   1) Run one last reconcile to pick up deposits that may have landed
  //      between webhook + tick. Any deposit whose paid_at_sec <= ends_at
  //      still counts (handleDepositTransfer enforces that).
  //   2) Read the current finalized blockhash (returns immediately).
  //   3) Compute winners deterministically (drawWinningNumbers).
  //   4) Write blockhash + winners + status='completed' in one update.
  //   5) Flag is_winner on number rows; queue payouts + sweeps.
  //   6) Tear down Helius webhook.
  //   7) Create the next round.
  //
  // If any step throws, the next tick (≤1 min later) re-runs from the top —
  // the round is still 'active' so we re-attempt the whole atomic flow.
  if (round.status === "active" && now >= new Date(round.ends_at)) {
    // Final reconcile pass for deposits that landed at the very last second.
    try {
      const last = await reconcilePendingDeposits(round.id);
      if (last > 0) actions.push(`confirmed ${last} last-second deposit(s)`);
    } catch (e) {
      void e;
    }

    const blockhash = await currentFinalizedBlockhash();
    const winners = drawWinningNumbers(blockhash, WINNERS_PER_ROUND);

    const { error: roundUpdErr } = await sb()
      .from("rounds")
      .update({
        status: "completed",
        draw_blockhash: blockhash,
        winning_numbers: winners,
        helius_webhook_id: null,
      })
      .eq("id", round.id);
    if (roundUpdErr) {
      throw new Error(
        `complete-round update failed: ${roundUpdErr.message}. ` +
          `If this mentions winning_numbers, run supabase/migrations/0002_winners_count_9.sql`
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

    const { data: allNumbers } = await sb()
      .from("numbers")
      .select("id")
      .eq("round_id", round.id);
    if (allNumbers && allNumbers.length > 0) {
      const sweepRows = allNumbers.map((r) => ({
        round_id: round!.id,
        number_id: r.id,
        status: "pending" as const,
      }));
      await sb().from("sweeps").insert(sweepRows);
    }

    if (round.helius_webhook_id) {
      try {
        await deleteHeliusWebhook(round.helius_webhook_id);
      } catch (e) {
        void e;
      }
    }

    actions.push(`round ${round.id} → completed, winners ${winners.join(",")}`);
    await createRound({ startsAt: new Date() });
    actions.push(`new round queued`);
  }

  // Global background workers: drain pending payouts, sweeps, and refunds
  // every tick regardless of round status.
  const p = await processPayouts({ maxPerTick: 10 });
  const s = await processSweeps({ maxPerTick: 25 });
  const r = await processRefunds({ maxPerTick: 10 });
  if (p.sent || s.sent || r.sent) {
    actions.push(`paid ${p.sent}, swept ${s.sent}, refunded ${r.sent}`);
  }

  return { actions };
}
