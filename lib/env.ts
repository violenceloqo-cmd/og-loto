// Centralized env access. Server-only secrets throw if accessed in the browser.
import "server-only";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const env = {
  SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  SOLANA_CLUSTER: (process.env.NEXT_PUBLIC_SOLANA_CLUSTER || "mainnet-beta") as
    | "mainnet-beta"
    | "devnet"
    | "testnet",

  get SUPABASE_SERVICE_ROLE_KEY() { return required("SUPABASE_SERVICE_ROLE_KEY"); },
  get TREASURY_PRIVATE_KEY()      { return required("TREASURY_PRIVATE_KEY"); },
  get CRON_SECRET()               { return required("CRON_SECRET"); },

  // SPL mint of the project token a wallet must hold to enter.
  get LOTTO_TOKEN_MINT()          { return required("LOTTO_TOKEN_MINT"); },
  // Minimum UI-amount of the token (decimals-aware). Falls back to 100_000.
  LOTTO_MIN_TOKEN_AMOUNT_UI: Number(process.env.LOTTO_MIN_TOKEN_AMOUNT_UI ?? "100000"),

  // Optional: Helius RPC. If unset, falls back to the public Solana RPC.
  HELIUS_API_KEY: process.env.HELIUS_API_KEY ?? "",
  // Optional: Cloudflare Turnstile (server-side bot protection).
  TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY ?? "",
};

export function rpcUrl(): string {
  if (env.HELIUS_API_KEY) {
    const cluster = env.SOLANA_CLUSTER === "devnet" ? "devnet" : "mainnet";
    return `https://${cluster}.helius-rpc.com/?api-key=${env.HELIUS_API_KEY}`;
  }
  return env.SOLANA_CLUSTER === "devnet"
    ? "https://api.devnet.solana.com"
    : "https://api.mainnet-beta.solana.com";
}
