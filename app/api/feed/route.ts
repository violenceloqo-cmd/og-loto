import { NextResponse } from "next/server";
import { sb } from "../../../lib/supabase/server";

export const dynamic = "force-dynamic";

interface FeedRow {
  number_id: number;
  round_id: number;
  n: number;
  status: string;
  is_winner: boolean;
  sender_wallet: string | null;
  reserved_at: string | null;
  deposit_signature: string | null;
  payout_signature: string | null;
  payout_status: string | null;
}

interface PastRound {
  id: number;
  status: string;
  ends_at: string;
  winning_numbers: number[] | null;
  draw_blockhash: string | null;
  picks: FeedRow[];
}

const PAST_ROUND_LIMIT = 5;

export async function GET() {
  const client = sb();

  const { data: live } = await client
    .from("rounds")
    .select("id, status, starts_at, ends_at, winning_numbers, draw_blockhash")
    .in("status", ["upcoming", "active", "drawing", "settling"])
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  let current: { round_id: number | null; picks: FeedRow[] } = {
    round_id: live?.id ?? null,
    picks: [],
  };
  if (live?.id) {
    const { data: rows } = await client
      .from("public_feed")
      .select("*")
      .eq("round_id", live.id)
      .order("reserved_at", { ascending: false });
    current = { round_id: live.id, picks: (rows ?? []) as FeedRow[] };
  }

  // Pull a generous window of recently completed rounds, then keep only the
  // ones that actually had reservations so the UI never shows empty "ghost"
  // rounds with 0 picks / 0 winners.
  const { data: completed } = await client
    .from("rounds")
    .select("id, status, ends_at, winning_numbers, draw_blockhash")
    .eq("status", "completed")
    .order("id", { ascending: false })
    .limit(PAST_ROUND_LIMIT * 10);

  const past: PastRound[] = [];
  if (completed?.length) {
    const ids = completed.map((r) => r.id as number);
    const { data: rows } = await client
      .from("public_feed")
      .select("*")
      .in("round_id", ids);
    const byRound = new Map<number, FeedRow[]>();
    for (const row of (rows ?? []) as FeedRow[]) {
      const arr = byRound.get(row.round_id) ?? [];
      arr.push(row);
      byRound.set(row.round_id, arr);
    }
    for (const r of completed) {
      const picks = byRound.get(r.id as number) ?? [];
      if (picks.length === 0) continue;
      past.push({
        id: r.id as number,
        status: r.status as string,
        ends_at: r.ends_at as string,
        winning_numbers: (r.winning_numbers as number[] | null) ?? null,
        draw_blockhash: (r.draw_blockhash as string | null) ?? null,
        picks,
      });
      if (past.length >= PAST_ROUND_LIMIT) break;
    }
  }

  return NextResponse.json({ current, past });
}
