// Refund processor — handles wrong-amount, late, or over-limit deposits.
// Refunds are sent from the per-number deposit wallet (we derive its keypair).
import "server-only";
import { sb } from "../supabase/server";
import { getNumberKeypair } from "../solana/derive";
import { sendSol } from "../solana/transfer";

export async function processRefunds(opts: { maxPerTick: number }): Promise<{ sent: number }> {
  const { data: rows } = await sb()
    .from("refunds")
    .select("id, round_id, deposit_address, sender_wallet, amount_lamports, attempts")
    .eq("status", "pending")
    .lt("attempts", 3)
    .order("created_at")
    .limit(opts.maxPerTick);

  if (!rows || rows.length === 0) return { sent: 0 };
  let sent = 0;

  for (const r of rows as Array<{
    id: number;
    round_id: number | null;
    deposit_address: string;
    sender_wallet: string;
    amount_lamports: number;
    attempts: number;
  }>) {
    try {
      // Resolve which number this deposit address belongs to so we can derive the keypair
      const { data: num } = await sb()
        .from("numbers")
        .select("n, round_id")
        .eq("deposit_address", r.deposit_address)
        .maybeSingle();
      if (!num) throw new Error("number not found for deposit address");

      const kp = getNumberKeypair(BigInt(num.round_id as number), num.n as number);
      // Refund amount minus 5000 lamport fee, never more than received
      const fee = 5000;
      const amount = Math.max(0, Number(r.amount_lamports) - fee);
      if (amount <= 0) {
        await sb()
          .from("refunds")
          .update({ status: "failed", last_error: "dust below fee" })
          .eq("id", r.id);
        continue;
      }
      const { signature } = await sendSol(kp, r.sender_wallet, amount);
      await sb()
        .from("refunds")
        .update({ status: "sent", tx_signature: signature, attempts: r.attempts + 1 })
        .eq("id", r.id);
      sent++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const attempts = r.attempts + 1;
      await sb()
        .from("refunds")
        .update({
          attempts,
          last_error: msg,
          status: attempts >= 3 ? "failed" : "pending",
        })
        .eq("id", r.id);
    }
  }

  return { sent };
}
