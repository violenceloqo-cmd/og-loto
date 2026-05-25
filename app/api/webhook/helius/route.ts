// Helius pushes here on every inbound transfer to a watched address.
import { NextResponse } from "next/server";
import { verifyHeliusRequest } from "../../../../lib/helius/verify";
import { handleDepositTransfer } from "../../../../lib/payments/deposit-transfer";

export const dynamic = "force-dynamic";

interface HeliusNativeTransfer {
  fromUserAccount: string;
  toUserAccount: string;
  amount: number;
}
interface HeliusTxEvent {
  signature: string;
  timestamp: number;
  nativeTransfers?: HeliusNativeTransfer[];
}

export async function POST(req: Request) {
  if (!verifyHeliusRequest(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let events: HeliusTxEvent[];
  try {
    const body = await req.json();
    events = Array.isArray(body) ? body : [body];
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  let processed = 0;
  let reserved = 0;
  let refunded = 0;
  let skipped = 0;

  for (const ev of events) {
    if (!ev?.nativeTransfers?.length) {
      skipped++;
      continue;
    }
    for (const t of ev.nativeTransfers) {
      processed++;
      const r = await handleDepositTransfer({
        signature: ev.signature,
        from: t.fromUserAccount,
        to: t.toUserAccount,
        amount: t.amount,
        paidAtSec: ev.timestamp,
      });
      if (r === "reserved") reserved++;
      else if (r === "refund_queued") refunded++;
      else skipped++;
    }
  }

  return NextResponse.json({ ok: true, processed, reserved, refunded, skipped });
}
