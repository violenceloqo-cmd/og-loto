import { NextResponse } from "next/server";
import { sb } from "../../../../lib/supabase/server";
import { REVEAL_DELAY_MS, tick } from "../../../../lib/rounds/state-machine";

export const dynamic = "force-dynamic";

export async function GET() {
  // Locally there is no Vercel Cron — advance the state machine on each poll
  // so rounds progress (upcoming → active → completed → next round) without
  // a manual curl.
  if (process.env.NODE_ENV === "development") {
    try {
      await tick();
    } catch (e) {
      console.error("[dev] state-machine tick failed:", e);
    }
  }

  // Reveal window: if the most recent round is 'completed' and ended very
  // recently, keep returning *that* round so the UI plays the winning-ball
  // drop animation and shows winners for a moment, even though the next
  // round may already be sitting in the DB as 'upcoming' with a future
  // starts_at. This is what makes the timer pause on "ROUND OVER" instead
  // of instantly snapping to a fresh empty drum.
  const { data: latestCompleted } = await sb()
    .from("rounds")
    .select("id, status, starts_at, ends_at, winning_numbers, draw_blockhash")
    .eq("status", "completed")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestCompleted) {
    const endedMs = new Date(latestCompleted.ends_at).getTime();
    if (Date.now() - endedMs < REVEAL_DELAY_MS) {
      return NextResponse.json({ round: latestCompleted });
    }
  }

  // We still query legacy 'drawing' / 'settling' values so any historical
  // zombie rows in the DB get returned and reaped on the next tick instead
  // of being invisible.
  const { data: round } = await sb()
    .from("rounds")
    .select("id, status, starts_at, ends_at, winning_numbers, draw_blockhash")
    .in("status", ["upcoming", "active", "drawing", "settling"])
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!round) {
    // Fall back to the latest completed for display continuity
    return NextResponse.json({ round: latestCompleted ?? null });
  }
  return NextResponse.json({ round });
}
