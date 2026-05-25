# Lotto Coin

Live Solana lottery. 5-minute rounds. 100 numbers. 0.1 SOL per number. 5 winning balls drawn from a future Solana blockhash. Each winning number pays 0.1 SOL automatically from a treasury wallet to the payout address the user provided at purchase.

## How a round works

1. The state machine creates a new round and derives 100 deposit keypairs from `MASTER_MNEMONIC` along the path `m/44'/501'/{roundId}'/{n}'`.
2. A single Helius webhook is registered watching all 100 addresses.
3. Users open the page, click an available number, paste a payout wallet, and send 0.1 SOL to the unique deposit address shown.
4. Helius pushes the inbound transfer to `/api/webhook/helius`. The handler verifies amount, round status, per-sender 5-number limit, and idempotency — then flips the number to `reserved` and broadcasts via Supabase Realtime. Wrong-amount / over-limit / late transfers are queued for refund.
5. At round end the state machine commits a target slot ~20s in the future, then resolves its blockhash. `drawWinningNumbers(blockhash, 5)` picks 5 distinct numbers in [1,100].
6. The cron processes payouts (0.1 SOL × winning-number-count per winner, sent from `TREASURY_PRIVATE_KEY`), sweeps all 100 deposit wallets back to treasury, and deletes the Helius webhook. Next round auto-starts.

## Setup

### 1. Supabase

Create a project, then in the SQL editor paste and run [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql).

Confirm Realtime is enabled on the `numbers` and `rounds` tables (the migration does this via `alter publication`).

### 2. Helius

1. Create a Helius account.
2. Copy your API key into `HELIUS_API_KEY`.
3. Pick any random string for `HELIUS_WEBHOOK_SECRET` — Helius will send it back in the `Authorization` header of webhook calls, and our verifier checks against it.

### 3. Wallets

- Generate a BIP39 mnemonic offline. Put it in `MASTER_MNEMONIC`. **Keep a paper backup.**
- Generate (or use an existing) Solana keypair as your treasury. Export the secret key (Phantom → Settings → Export private key) and put it in `TREASURY_PRIVATE_KEY`.
- Fund the treasury with enough SOL to cover ~50× max round payout (`50 × 5 × 0.1 = 25 SOL` recommended).

### 4. Cloudflare Turnstile

Create a site, copy the site key into `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and the secret into `TURNSTILE_SECRET_KEY`. Turnstile is enforced when `TURNSTILE_SECRET_KEY` is set — in dev you can leave it unset to bypass.

### 5. Env vars

Copy `.env.example` to `.env.local` and fill in every value.

### 6. Run

```bash
npm install
npm run dev
```

Then in a second terminal, trigger the state machine once to bootstrap the first round:

```bash
curl -H "Authorization: $(grep CRON_SECRET .env.local | cut -d= -f2)" http://localhost:3000/api/cron/tick
```

In production, Vercel Cron runs `/api/cron/tick` every minute automatically (configured in [`vercel.json`](vercel.json)).

## Deploy

1. Push to GitHub.
2. Connect the repo on Vercel.
3. Add all env vars from `.env.example` to the Vercel project (mark public ones as plain, the rest as encrypted).
4. Set `APP_URL` to your deployed URL.
5. First deploy registers the Vercel Cron automatically.

## Test plan (devnet first)

1. Set `NEXT_PUBLIC_SOLANA_CLUSTER=devnet` and use a devnet Helius webhook (the code switches to `enhancedDevnet` automatically).
2. Airdrop SOL to the treasury (`solana airdrop 5 <treasury_address> --url devnet`).
3. Run `npm run dev`, hit the cron once to start a round.
4. In two browser windows, reserve a number, send 0.1 devnet SOL, and confirm both windows see the state change within ~5s.
5. Wait 5 minutes. Verify the draw → settle → completed transitions in the `rounds` table, and that a payout tx appears on the devnet explorer.
6. Flip `NEXT_PUBLIC_SOLANA_CLUSTER=mainnet-beta` and run a small real-money test before opening to the public.

## Files

| Path | Purpose |
|---|---|
| `supabase/migrations/0001_init.sql` | Schema + RLS + Realtime publication |
| `lib/solana/derive.ts` | HD derivation of per-round per-number keypairs |
| `lib/solana/treasury.ts` | Treasury signer loader |
| `lib/solana/transfer.ts` | `sendSol` + `sweepAll` |
| `lib/solana/randomness.ts` | blockhash → 5 distinct numbers (pure, tested) |
| `lib/rounds/state-machine.ts` | tick(): drives all state transitions |
| `lib/rounds/bootstrap.ts` | createRound + activateRound (+ Helius webhook) |
| `lib/payouts/process.ts` | Pays winners from treasury |
| `lib/payouts/sweeps.ts` | Sweeps per-number wallets back to treasury |
| `lib/payouts/refunds.ts` | Refunds wrong-amount / over-limit / late deposits |
| `lib/helius/webhooks.ts` | Create/delete Helius enhanced webhooks |
| `lib/helius/verify.ts` | HMAC-style header verification |
| `app/api/cron/tick/route.ts` | Vercel Cron entrypoint |
| `app/api/reserve/route.ts` | Pre-reservation endpoint |
| `app/api/webhook/helius/route.ts` | Inbound transfer notifications |
| `app/api/round/current/route.ts` | Current-round summary for the browser |
| `components/scene/*` | Three.js / R3F / Rapier vacuum chamber |
| `components/ui/*` | NumberGrid, ReservationModal, RoundTimer, WinnersBanner |
| `components/providers/RealtimeProvider.tsx` | Supabase Realtime subscriptions |

## Operational notes

- **Treasury balance**: keep ~25 SOL hot. Sweep excess to cold storage daily.
- **Key rotation**: round IDs increase, so derivation paths for old rounds never collide with new ones. Safe to rotate the mnemonic any time — new rounds will use the new seed.
- **Cron failures**: the state machine is idempotent. If a tick fails, the next one resumes. Look for stuck rounds via `select * from rounds where status != 'completed'`.
- **Manual reconciliation**: failed payouts and failed sweeps land in `payouts.status='failed'` / `sweeps.status='failed'` after 3 attempts. Investigate `last_error`.
