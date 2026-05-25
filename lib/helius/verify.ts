import "server-only";
import { env } from "../env";

/** Helius sends our configured `authHeader` value verbatim as the Authorization header. */
export function verifyHeliusRequest(req: Request): boolean {
  const got = req.headers.get("authorization") ?? "";
  return got === env.HELIUS_WEBHOOK_SECRET;
}
