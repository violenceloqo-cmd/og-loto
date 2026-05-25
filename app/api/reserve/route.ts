// POST /api/reserve
// Body: { round_id, n, payout_wallet, turnstile_token }
// Soft-locks number `n` to 'pending' for PENDING_TTL minutes and returns its deposit address.
import { NextResponse } from "next/server";
import { sb } from "../../../lib/supabase/server";
import { verifyTurnstile } from "../../../lib/turnstile";
import { isValidSolanaAddress } from "../../../lib/solana/validate";
import { RESERVATION_LAMPORTS, RESERVATION_SOL } from "../../../lib/lotto/constants";

export const dynamic = "force-dynamic";

const PENDING_TTL_MS = 3 * 60 * 1000;
const LATE_RESERVATION_CUTOFF_MS = 30 * 1000;

export async function POST(req: Request) {
  let body: { round_id?: number; n?: number; payout_wallet?: string; turnstile_token?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  const roundId = Number(body.round_id);
  const n = Number(body.n);
  const payoutWallet = String(body.payout_wallet ?? "").trim();
  const turnstileToken = String(body.turnstile_token ?? "");

  if (!Number.isFinite(roundId) || roundId <= 0) {
    return NextResponse.json({ error: "bad_round_id" }, { status: 400 });
  }
  if (!Number.isInteger(n) || n < 1 || n > 100) {
    return NextResponse.json({ error: "bad_n" }, { status: 400 });
  }
  if (!isValidSolanaAddress(payoutWallet)) {
    return NextResponse.json({ error: "bad_payout_wallet" }, { status: 400 });
  }

  // Turnstile is optional in dev (skip if no token AND no secret configured)
  if (process.env.TURNSTILE_SECRET_KEY) {
    const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0];
    const ok = await verifyTurnstile(turnstileToken, ip ?? undefined);
    if (!ok) return NextResponse.json({ error: "turnstile_failed" }, { status: 403 });
  }

  // Verify round is active and we're not in the last 30s
  const { data: round } = await sb()
    .from("rounds")
    .select("id, status, ends_at")
    .eq("id", roundId)
    .maybeSingle();
  if (!round) return NextResponse.json({ error: "round_not_found" }, { status: 404 });
  if (round.status !== "active") return NextResponse.json({ error: "round_not_active" }, { status: 409 });
  const endsAt = new Date(round.ends_at as string).getTime();
  if (Date.now() > endsAt - LATE_RESERVATION_CUTOFF_MS) {
    return NextResponse.json({ error: "round_closing" }, { status: 409 });
  }

  // Atomic-ish update: only switch to pending if currently available
  const pendingUntil = new Date(Date.now() + PENDING_TTL_MS).toISOString();
  const { data: updated, error: updErr } = await sb()
    .from("numbers")
    .update({ status: "pending", pending_until: pendingUntil, payout_wallet: payoutWallet })
    .eq("round_id", roundId)
    .eq("n", n)
    .eq("status", "available")
    .select("id, deposit_address, pending_until")
    .maybeSingle();

  if (updErr) {
    return NextResponse.json({ error: "db_error", detail: updErr.message }, { status: 500 });
  }
  if (!updated) {
    return NextResponse.json({ error: "already_taken" }, { status: 409 });
  }

  return NextResponse.json({
    ok: true,
    n,
    round_id: roundId,
    deposit_address: updated.deposit_address,
    pending_until: updated.pending_until,
    amount_sol: RESERVATION_SOL,
    amount_lamports: RESERVATION_LAMPORTS,
  });
}
