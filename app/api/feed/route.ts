import { NextResponse } from "next/server";
import { sb } from "../../../lib/supabase/server";

export const dynamic = "force-dynamic";

interface FeedRow {
  number_id: number;
  round_id: number;
  n: number;
  status: string;
  is_winner: boolean;
  sender_wallet: string | null; // holder/payout wallet (the same wallet, post-migration)
  reserved_at: string | null;
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

/** Mirror of the reveal-window cap in /api/round/current. */
const RECENT_COMPLETED_MAX_AGE_MS = 10 * 60 * 1000;

export async function GET() {
  const client = sb();

  const { data: live } = await client
    .from("rounds")
    .select("id, status, starts_at, ends_at, winning_numbers, draw_blockhash")
    .in("status", ["upcoming", "active", "drawing", "settling"])
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: latestCompleted } = await client
    .from("rounds")
    .select("id, status, ends_at")
    .eq("status", "completed")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Keep "current" pointed at the just-completed round during the reveal
  // window (same logic as /api/round/current) so winners + payout links stay
  // visible in the activity feed instead of snapping to an empty new round.
  let currentRoundId: number | null = live?.id ?? null;
  if (latestCompleted) {
    const endedRecently =
      Date.now() - new Date(latestCompleted.ends_at).getTime() < RECENT_COMPLETED_MAX_AGE_MS;
    const nextStarted =
      !!live &&
      (live.status !== "upcoming" || Date.now() >= new Date(live.starts_at).getTime());
    if (endedRecently && !nextStarted) {
      currentRoundId = latestCompleted.id as number;
    }
  }

  let current: { round_id: number | null; picks: FeedRow[] } = {
    round_id: currentRoundId,
    picks: [],
  };
  if (currentRoundId) {
    const { data: rows } = await client
      .from("public_feed")
      .select("*")
      .eq("round_id", currentRoundId)
      .order("reserved_at", { ascending: false });
    current = { round_id: currentRoundId, picks: (rows ?? []) as FeedRow[] };
  }

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
      // Include rounds without picks too — winning numbers + draw proof are
      // still worth showing in the history.
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
