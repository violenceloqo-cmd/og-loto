// POST /api/reserve
// Body: { round_id, n, holding_wallet, turnstile_token? }
//
// Verifies the wallet holds at least LOTTO_MIN_TOKEN_AMOUNT_UI of the project
// token, then atomically flips number `n` from 'available' to 'reserved' in
// one update. No intermediate `pending` state, no deposit address — the
// holding wallet is the payout wallet.
import { NextResponse } from "next/server";
import { sb } from "../../../lib/supabase/server";
import { verifyTurnstile } from "../../../lib/turnstile";
import { isValidSolanaAddress } from "../../../lib/solana/validate";
import { verifyTokenHolding } from "../../../lib/solana/token-holding";
import { PAYOUT_SOL } from "../../../lib/lotto/constants";

export const dynamic = "force-dynamic";

const LATE_RESERVATION_CUTOFF_MS = 30 * 1000;

export async function POST(req: Request) {
  let body: { round_id?: number; n?: number; holding_wallet?: string; turnstile_token?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  const roundId = Number(body.round_id);
  const n = Number(body.n);
  const holdingWallet = String(body.holding_wallet ?? "").trim();
  const turnstileToken = String(body.turnstile_token ?? "");

  if (!Number.isFinite(roundId) || roundId <= 0) {
    return NextResponse.json({ error: "bad_round_id" }, { status: 400 });
  }
  if (!Number.isInteger(n) || n < 1 || n > 100) {
    return NextResponse.json({ error: "bad_n" }, { status: 400 });
  }
  if (!isValidSolanaAddress(holdingWallet)) {
    return NextResponse.json({ error: "bad_holding_wallet" }, { status: 400 });
  }

  // Optional bot protection.
  if (process.env.TURNSTILE_SECRET_KEY) {
    const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0];
    const ok = await verifyTurnstile(turnstileToken, ip ?? undefined);
    if (!ok) return NextResponse.json({ error: "turnstile_failed" }, { status: 403 });
  }

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

  // Token-gating check (RPC call to Solana).
  let holding;
  try {
    holding = await verifyTokenHolding(holdingWallet);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[reserve] holding_check_failed:", msg);
    return NextResponse.json({ error: "holding_check_failed", detail: msg }, { status: 502 });
  }
  if (!holding.ok) {
    return NextResponse.json(
      {
        error: "insufficient_holding",
        ui_amount: holding.uiAmount,
        required: holding.required,
      },
      { status: 403 }
    );
  }

  // Atomic flip: available -> reserved. The partial unique index
  // numbers_one_per_wallet_per_round enforces one pick per wallet.
  const { data: updated, error: updErr } = await sb()
    .from("numbers")
    .update({
      status: "reserved",
      payout_wallet: holdingWallet,
      holding_wallet: holdingWallet,
      reserved_at: new Date().toISOString(),
    })
    .eq("round_id", roundId)
    .eq("n", n)
    .eq("status", "available")
    .select("id")
    .maybeSingle();

  if (updErr) {
    // Unique-violation on the partial index surfaces as a 23505 in PostgREST.
    const code = (updErr as { code?: string }).code;
    if (code === "23505") {
      return NextResponse.json({ error: "wallet_already_picked" }, { status: 409 });
    }
    return NextResponse.json({ error: "db_error", detail: updErr.message }, { status: 500 });
  }
  if (!updated) {
    return NextResponse.json({ error: "already_taken" }, { status: 409 });
  }

  return NextResponse.json({
    ok: true,
    n,
    round_id: roundId,
    ui_amount: holding.uiAmount,
    payout_sol: PAYOUT_SOL,
  });
}
