// Shared deposit confirmation logic for Helius webhooks + on-chain reconciliation.
import "server-only";
import { sb } from "../supabase/server";
import { RESERVATION_LAMPORTS } from "../lotto/constants";

const PER_USER_LIMIT = 5;

export type DepositOutcome = "reserved" | "refund_queued" | "ignored";

export async function handleDepositTransfer(args: {
  signature: string;
  from: string;
  to: string;
  amount: number;
  /** Unix seconds — when set, accept payment if it landed before round ends_at. */
  paidAtSec?: number;
}): Promise<DepositOutcome> {
  const { data: dup } = await sb()
    .from("numbers")
    .select("id")
    .eq("tx_signature", args.signature)
    .maybeSingle();
  if (dup) return "ignored";

  const { data: num } = await sb()
    .from("numbers")
    .select("id, round_id, n, status, pending_until")
    .eq("deposit_address", args.to)
    .maybeSingle();
  if (!num) return "ignored";

  const { data: round } = await sb()
    .from("rounds")
    .select("id, status, ends_at")
    .eq("id", num.round_id)
    .maybeSingle();
  if (!round) return "ignored";

  const endsAtMs = new Date(round.ends_at as string).getTime();
  const paidAtMs = args.paidAtSec ? args.paidAtSec * 1000 : Date.now();
  const paidInTime = paidAtMs <= endsAtMs;
  const roundLiveNow =
    round.status === "active" && Date.now() < endsAtMs;
  const roundAccepting = roundLiveNow || (paidInTime && round.status !== "completed");

  if (args.amount !== RESERVATION_LAMPORTS) {
    await queueRefund({
      roundId: num.round_id as number,
      depositAddress: args.to,
      sender: args.from,
      amount: args.amount,
      sourceSig: args.signature,
      reason: `wrong_amount: got ${args.amount}, expected ${RESERVATION_LAMPORTS}`,
    });
    return "refund_queued";
  }

  if (!roundAccepting) {
    await queueRefund({
      roundId: num.round_id as number,
      depositAddress: args.to,
      sender: args.from,
      amount: args.amount,
      sourceSig: args.signature,
      reason: "round_closed",
    });
    return "refund_queued";
  }

  const { count: countForSender } = await sb()
    .from("numbers")
    .select("id", { count: "exact", head: true })
    .eq("round_id", num.round_id)
    .eq("sender_wallet", args.from)
    .eq("status", "reserved");
  if ((countForSender ?? 0) >= PER_USER_LIMIT) {
    await queueRefund({
      roundId: num.round_id as number,
      depositAddress: args.to,
      sender: args.from,
      amount: args.amount,
      sourceSig: args.signature,
      reason: "per_user_limit",
    });
    return "refund_queued";
  }

  const { data: updated, error: updErr } = await sb()
    .from("numbers")
    .update({
      status: "reserved",
      sender_wallet: args.from,
      tx_signature: args.signature,
      reserved_at: new Date().toISOString(),
    })
    .eq("id", num.id)
    .in("status", ["pending", "available"])
    .select("id, payout_wallet")
    .maybeSingle();

  if (updErr || !updated) {
    await queueRefund({
      roundId: num.round_id as number,
      depositAddress: args.to,
      sender: args.from,
      amount: args.amount,
      sourceSig: args.signature,
      reason: "race_lost",
    });
    return "refund_queued";
  }

  if (!updated.payout_wallet) {
    await sb().from("numbers").update({ payout_wallet: args.from }).eq("id", num.id);
  }

  return "reserved";
}

async function queueRefund(args: {
  roundId: number | null;
  depositAddress: string;
  sender: string;
  amount: number;
  sourceSig: string;
  reason: string;
}) {
  await sb().from("refunds").insert({
    round_id: args.roundId,
    deposit_address: args.depositAddress,
    sender_wallet: args.sender,
    amount_lamports: args.amount,
    reason: args.reason,
    source_signature: args.sourceSig,
    status: "pending",
  });
}
