// Pay winners from treasury.
import "server-only";
import { sb } from "../supabase/server";
import { treasury } from "../solana/treasury";
import { sendSol } from "../solana/transfer";

export async function processPayouts(opts: { maxPerTick: number }): Promise<{ sent: number }> {
  const { data: rows } = await sb()
    .from("payouts")
    .select("id, payout_wallet, amount_lamports, attempts")
    .eq("status", "pending")
    .lt("attempts", 3)
    .order("created_at")
    .limit(opts.maxPerTick);

  if (!rows || rows.length === 0) return { sent: 0 };
  let sent = 0;
  for (const r of rows) {
    try {
      const { signature } = await sendSol(
        treasury(),
        r.payout_wallet as string,
        Number(r.amount_lamports)
      );
      await sb()
        .from("payouts")
        .update({ status: "sent", tx_signature: signature, attempts: (r.attempts as number) + 1 })
        .eq("id", r.id);
      sent++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const attempts = (r.attempts as number) + 1;
      await sb()
        .from("payouts")
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
