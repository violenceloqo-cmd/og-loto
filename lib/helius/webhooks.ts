// Helius Enhanced Webhooks — push notifications for inbound SOL transfers.
// Docs: https://docs.helius.dev/webhooks-and-websockets/api-reference/edit-webhook
import "server-only";
import { env } from "../env";

const HELIUS_API = "https://api.helius.xyz/v0/webhooks";

interface HeliusWebhook {
  webhookID: string;
  webhookURL: string;
  accountAddresses: string[];
  transactionTypes: string[];
  webhookType: string;
  authHeader?: string;
}

function api() {
  return `${HELIUS_API}?api-key=${env.HELIUS_API_KEY}`;
}

export async function createHeliusWebhook(args: {
  addresses: string[];
  webhookUrl: string;
}): Promise<string> {
  const body = {
    webhookURL: args.webhookUrl,
    accountAddresses: args.addresses,
    transactionTypes: ["ANY"],
    webhookType: env.SOLANA_CLUSTER === "devnet" ? "enhancedDevnet" : "enhanced",
    authHeader: env.HELIUS_WEBHOOK_SECRET,
  };
  const res = await fetch(api(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`createHeliusWebhook failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as HeliusWebhook;
  return json.webhookID;
}

export async function deleteHeliusWebhook(webhookId: string): Promise<void> {
  const res = await fetch(`${HELIUS_API}/${webhookId}?api-key=${env.HELIUS_API_KEY}`, {
    method: "DELETE",
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`deleteHeliusWebhook failed: ${res.status} ${await res.text()}`);
  }
}

/** List all webhooks under this Helius account. */
export async function listHeliusWebhooks(): Promise<HeliusWebhook[]> {
  const res = await fetch(api(), { method: "GET" });
  if (!res.ok) {
    throw new Error(`listHeliusWebhooks failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as HeliusWebhook[];
}

/** Delete every Helius webhook NOT in `keepIds`. Used to purge orphans left
 *  behind by crashes, hot-reloads, or .env URL changes — keeps the account
 *  from leaking up to its 50-webhook cap. Failures are swallowed per-webhook
 *  so one broken delete doesn't block the rest. Returns the number deleted. */
export async function purgeOrphanWebhooks(keepIds: Set<string>): Promise<number> {
  let hooks: HeliusWebhook[] = [];
  try {
    hooks = await listHeliusWebhooks();
  } catch {
    return 0;
  }
  let deleted = 0;
  for (const h of hooks) {
    if (keepIds.has(h.webhookID)) continue;
    try {
      await deleteHeliusWebhook(h.webhookID);
      deleted++;
    } catch {
      // best-effort
    }
  }
  return deleted;
}
