// Round lifecycle: create a new round + populate 100 number rows.
// Under the token-gated model there are no per-number deposit addresses
// and no Helius webhook to register — both functions are deliberately tiny.
import "server-only";
import { sb } from "../supabase/server";

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

  const rows = Array.from({ length: 100 }, (_, i) => ({
    round_id: Number(roundId),
    n: i + 1,
    status: "available" as const,
  }));
  const { error: insertErr } = await sb().from("numbers").insert(rows);
  if (insertErr) throw new Error(`insert numbers failed: ${insertErr.message}`);

  return roundId;
}

/** Move 'upcoming' → 'active'. */
export async function activateRound(roundId: bigint): Promise<void> {
  const { error } = await sb()
    .from("rounds")
    .update({ status: "active" })
    .eq("id", Number(roundId));
  if (error) throw new Error(`activate update failed: ${error.message}`);
}
