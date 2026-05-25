// Sweep per-number deposit wallets into the configured receive wallet
// (RECEIVE_WALLET_ADDRESS, falls back to treasury) after a round settles.
import "server-only";
import { sb } from "../supabase/server";
import { receiveAddress } from "../solana/treasury";
import { getNumberKeypair } from "../solana/derive";
import { sweepAll } from "../solana/transfer";

export async function processSweeps(opts: { maxPerTick: number }): Promise<{ sent: number; skipped: number }> {
  const { data: rows } = await sb()
    .from("sweeps")
    .select("id, round_id, number_id, attempts")
    .eq("status", "pending")
    .lt("attempts", 3)
    .order("created_at")
    .limit(opts.maxPerTick);

  if (!rows || rows.length === 0) return { sent: 0, skipped: 0 };

  // Bulk-load the matching numbers in one query
  const numberIds = rows.map((r) => r.number_id as number);
  const { data: nums } = await sb()
    .from("numbers")
    .select("id, n, round_id")
    .in("id", numberIds);
  const byId = new Map<number, { n: number; round_id: number }>();
  for (const x of nums ?? []) byId.set(x.id as number, { n: x.n as number, round_id: x.round_id as number });

  const dest = receiveAddress();
  let sent = 0;
  let skipped = 0;
  for (const r of rows as Array<{ id: number; number_id: number; attempts: number }>) {
    try {
      const meta = byId.get(r.number_id);
      if (!meta) throw new Error(`number ${r.number_id} not found`);
      const kp = getNumberKeypair(BigInt(meta.round_id), meta.n);
      const res = await sweepAll(kp, dest);
      if (!res) {
        await sb()
          .from("sweeps")
          .update({ status: "skipped", attempts: r.attempts + 1 })
          .eq("id", r.id);
        skipped++;
      } else {
        await sb()
          .from("sweeps")
          .update({ status: "sent", tx_signature: res.signature, attempts: r.attempts + 1 })
          .eq("id", r.id);
        sent++;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const attempts = r.attempts + 1;
      await sb()
        .from("sweeps")
        .update({
          attempts,
          last_error: msg,
          status: attempts >= 3 ? "failed" : "pending",
        })
        .eq("id", r.id);
    }
  }
  return { sent, skipped };
}
