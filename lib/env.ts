// Centralized env access. Server-only secrets throw if accessed in the browser.
import "server-only";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const env = {
  // public
  SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  SOLANA_CLUSTER: (process.env.NEXT_PUBLIC_SOLANA_CLUSTER || "mainnet-beta") as
    | "mainnet-beta"
    | "devnet"
    | "testnet",

  // server-only — accessed lazily so build doesn't fail on Vercel without them
  get SUPABASE_SERVICE_ROLE_KEY() { return required("SUPABASE_SERVICE_ROLE_KEY"); },
  get HELIUS_API_KEY()            { return required("HELIUS_API_KEY"); },
  get HELIUS_WEBHOOK_SECRET()     { return required("HELIUS_WEBHOOK_SECRET"); },
  get MASTER_MNEMONIC()           { return required("MASTER_MNEMONIC"); },
  get TREASURY_PRIVATE_KEY()      { return required("TREASURY_PRIVATE_KEY"); },
  // Optional: address that receives swept deposits. If not set, falls back to treasury.
  RECEIVE_WALLET_ADDRESS:         process.env.RECEIVE_WALLET_ADDRESS || "",
  get TURNSTILE_SECRET_KEY()      { return required("TURNSTILE_SECRET_KEY"); },
  get CRON_SECRET()               { return required("CRON_SECRET"); },
  get APP_URL()                   { return required("APP_URL"); },
};

export function rpcUrl(): string {
  if (process.env.HELIUS_API_KEY) {
    const cluster = env.SOLANA_CLUSTER === "devnet" ? "devnet" : "mainnet";
    return `https://${cluster}.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`;
  }
  return env.SOLANA_CLUSTER === "devnet"
    ? "https://api.devnet.solana.com"
    : "https://api.mainnet-beta.solana.com";
}
