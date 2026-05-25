import { NextResponse } from "next/server";
import { sb } from "../../../../lib/supabase/server";
import { tick } from "../../../../lib/rounds/state-machine";

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
    const { data: prev } = await sb()
      .from("rounds")
      .select("id, status, starts_at, ends_at, winning_numbers, draw_blockhash")
      .eq("status", "completed")
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();
    return NextResponse.json({ round: prev ?? null });
  }
  return NextResponse.json({ round });
}
