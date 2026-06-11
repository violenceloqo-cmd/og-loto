import { NextResponse } from "next/server";
import { sb } from "../../../../lib/supabase/server";
import { tick } from "../../../../lib/rounds/state-machine";

export const dynamic = "force-dynamic";

/** Only treat a completed round as "revealable" if it ended this recently.
 *  Guards against showing an ancient round after long downtime. */
const RECENT_COMPLETED_MAX_AGE_MS = 10 * 60 * 1000;

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

  const { data: latestCompleted } = await sb()
    .from("rounds")
    .select("id, status, starts_at, ends_at, winning_numbers, draw_blockhash")
    .eq("status", "completed")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  // We still query legacy 'drawing' / 'settling' values so any historical
  // zombie rows in the DB get returned and reaped on the next tick instead
  // of being invisible.
  const { data: live } = await sb()
    .from("rounds")
    .select("id, status, starts_at, ends_at, winning_numbers, draw_blockhash")
    .in("status", ["upcoming", "active", "drawing", "settling"])
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Reveal window: after a round completes, keep returning *that* round until
  // the next round actually starts, so the UI plays the winning-ball drop and
  // players get time to see the winning numbers. The next round is created
  // with starts_at = completion time + REVEAL_DELAY_MS, so anchoring on the
  // next round's starts_at — rather than the completed round's ends_at —
  // guarantees the full reveal even when the cron tick completed the round
  // long after its ends_at (common in production: cron runs once a minute).
  if (latestCompleted) {
    const endedRecently =
      Date.now() - new Date(latestCompleted.ends_at).getTime() < RECENT_COMPLETED_MAX_AGE_MS;
    const nextStarted =
      !!live &&
      (live.status !== "upcoming" || Date.now() >= new Date(live.starts_at).getTime());
    if (endedRecently && !nextStarted) {
      return NextResponse.json({ round: latestCompleted });
    }
  }

  if (!live) {
    // Fall back to the latest completed for display continuity
    return NextResponse.json({ round: latestCompleted ?? null });
  }
  return NextResponse.json({ round: live });
}
