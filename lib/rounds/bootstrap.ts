// Round lifecycle: create new round, populate 100 number rows, register Helius webhook.
import "server-only";
import { sb } from "../supabase/server";
import { deriveAllForRound } from "../solana/derive";
import { createHeliusWebhook } from "../helius/webhooks";
import { env } from "../env";

const ROUND_MS = 5 * 60 * 1000;

/** Insert a new 'upcoming' round + 100 number rows. Returns round id. */
export async function createRound(opts: { startsAt: Date }): Promise<bigint> {
  const startsAt = opts.startsAt;
  const endsAt = new Date(startsAt.getTime() + ROUND_MS);

  const { data, error } = await sb()
    .from("rounds")
    .insert({
      status: "upcoming",
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`createRound failed: ${error?.message}`);
  const roundId = BigInt(data.id);

  const derived = deriveAllForRound(roundId);
  const rows = derived.map((d) => ({
    round_id: Number(roundId),
    n: d.n,
    deposit_address: d.address,
    derivation_index: d.index,
    status: "available" as const,
  }));
  const { error: insertErr } = await sb().from("numbers").insert(rows);
  if (insertErr) throw new Error(`insert numbers failed: ${insertErr.message}`);

  return roundId;
}

/** Move 'upcoming' → 'active' and register the Helius webhook for its 100 addresses. */
export async function activateRound(roundId: bigint): Promise<void> {
  const { data: rows, error } = await sb()
    .from("numbers")
    .select("deposit_address")
    .eq("round_id", Number(roundId));
  if (error) throw new Error(`load addresses failed: ${error.message}`);
  const addresses = (rows ?? []).map((r) => r.deposit_address as string);
  if (addresses.length !== 100) {
    throw new Error(`expected 100 addresses for round ${roundId}, got ${addresses.length}`);
  }

  const webhookUrl = `${env.APP_URL.replace(/\/$/, "")}/api/webhook/helius`;
  const webhookId = await createHeliusWebhook({ addresses, webhookUrl });

  const { error: updErr } = await sb()
    .from("rounds")
    .update({ status: "active", helius_webhook_id: webhookId })
    .eq("id", Number(roundId));
  if (updErr) throw new Error(`activate update failed: ${updErr.message}`);
}
