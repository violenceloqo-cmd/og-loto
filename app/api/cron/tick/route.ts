import { NextResponse } from "next/server";
import { env } from "../../../../lib/env";
import { tick } from "../../../../lib/rounds/state-machine";

export const dynamic = "force-dynamic";

/** Vercel Cron hits this every minute. Protect via CRON_SECRET header. */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  // Vercel sends "Bearer $CRON_SECRET"; also accept the raw secret for manual testing.
  if (auth !== `Bearer ${env.CRON_SECRET}` && auth !== env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await tick();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
