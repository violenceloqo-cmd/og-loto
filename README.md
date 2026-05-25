# Lotto Coin

Live Solana lottery. 5-minute rounds. 100 numbers. **Token-gated entry** — hold at least `LOTTO_MIN_TOKEN_AMOUNT_UI` (default 100,000) of the project SPL token in your wallet to pick a number. 5 winning balls drawn from a finalized Solana blockhash. Each winner is paid 0.2 SOL automatically from a treasury wallet to the same wallet that proved the token holding.

## How a round works

1. The state machine creates a new round and seeds 100 number rows (`1..100`).
2. Players open the page, click an available number, and paste the wallet that holds the project token.
3. `/api/reserve` verifies the wallet's token balance over RPC (both classic SPL Token and Token-2022 programs are checked). If the balance is at or above the minimum, the number is atomically flipped from `available` to `reserved` in a single DB update. A partial unique index enforces one pick per wallet per round.
4. At round end (`ends_at`), the state machine reads the current finalized blockhash and runs `drawWinningNumbers(blockhash, 5)` to pick 5 distinct numbers in `[1,100]`.
5. The state machine queues a payout row for each winning reserved number, then `processPayouts` drains them by signing and sending 0.2 SOL from `TREASURY_PRIVATE_KEY` to each winner's holding wallet.

No on-chain deposits, no webhook plumbing, no sweep/refund queues — the entry gate is pure RPC + a single SQL update.

## Setup

### 1. Supabase

Create a project, then paste [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) into the SQL editor and run it. It defines the entire schema in one shot.

Confirm Realtime is enabled on the `numbers` and `rounds` tables (the migration does this via `alter publication`).

### 2. Project token

- Deploy/identify your SPL token mint on Solana (e.g. via pump.fun).
- Put the mint address in `LOTTO_TOKEN_MINT`.
- Set `LOTTO_MIN_TOKEN_AMOUNT_UI` to the human-readable minimum holding (default `100000`). Decimals are handled by the RPC's parsed `tokenAmount.uiAmount`, so you don't multiply by `10^decimals`.

### 3. Treasury

- Generate (or use an existing) Solana keypair as your treasury. Export the secret key (Phantom → Settings → Export private key) and put it in `TREASURY_PRIVATE_KEY` (base58 string or JSON byte array).
- Fund the treasury with enough SOL to cover ~50× max round payout (`50 × 5 × 0.2 = 50 SOL` recommended).

### 4. Optional: Helius RPC

Put your Helius API key in `HELIUS_API_KEY` for a faster RPC endpoint. Unset, the app falls back to the public Solana RPC.

### 5. Optional: Cloudflare Turnstile

Create a site, copy the site key into `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and the secret into `TURNSTILE_SECRET_KEY`. Turnstile is enforced when `TURNSTILE_SECRET_KEY` is set — in dev you can leave it unset to bypass.

### 6. Env vars

Copy `.env.example` to `.env.local` and fill in every value.

### 7. Run

```bash
npm install
npm run dev
```

Then in a second terminal, trigger the state machine once to bootstrap the first round:

```bash
curl -H "Authorization: Bearer $(grep CRON_SECRET .env.local | cut -d= -f2)" http://localhost:3000/api/cron/tick
```

In production, Vercel Cron runs `/api/cron/tick` every minute automatically (configured in [`vercel.json`](vercel.json)).

## Deploy

1. Push to GitHub.
2. Connect the repo on Vercel.
3. Add all env vars from `.env.example` to the Vercel project.
4. Set `APP_URL` to your deployed URL.
5. First deploy registers the Vercel Cron automatically.

## Test plan (devnet first)

1. Set `NEXT_PUBLIC_SOLANA_CLUSTER=devnet`.
2. Airdrop SOL to the treasury (`solana airdrop 5 <treasury_address> --url devnet`).
3. Create a devnet SPL token and mint at least 100,000 of it to a test wallet (`spl-token create-token --url devnet`, then `spl-token mint`). Set `LOTTO_TOKEN_MINT` to the new mint.
4. Run `npm run dev`, hit `/api/cron/tick` once to start a round.
5. Pick a number in the browser and paste the test wallet. Confirm the number flips to `reserved` instantly.
6. Wait 5 minutes. Verify the `active → completed` transition in `rounds`, and that a payout tx for any winning number appears on the devnet explorer.
7. Flip `NEXT_PUBLIC_SOLANA_CLUSTER=mainnet-beta` and use your real pump.fun mint for production.

## Files

| Path | Purpose |
|---|---|
| `supabase/migrations/*.sql` | Schema (run them in order) |
| `lib/solana/token-holding.ts` | RPC check that a wallet holds ≥ N of the project token |
| `lib/solana/treasury.ts` | Treasury signer loader |
| `lib/solana/transfer.ts` | `sendSol` helper |
| `lib/solana/randomness.ts` | blockhash → 5 distinct numbers (pure, tested) |
| `lib/rounds/state-machine.ts` | `tick()`: drives upcoming → active → completed |
| `lib/rounds/bootstrap.ts` | `createRound` + `activateRound` |
| `lib/payouts/process.ts` | Pays winners from treasury |
| `app/api/cron/tick/route.ts` | Vercel Cron entrypoint |
| `app/api/reserve/route.ts` | Token-gated reservation endpoint |
| `app/api/round/current/route.ts` | Current-round summary for the browser |
| `app/api/feed/route.ts` | Public activity feed |
| `components/scene/LottoMachine2D.tsx` | Cartoon lottery drum + reveal animation |
| `components/ui/*` | NumberGrid, ReservationModal, RoundTimer, WinnersBanner, ActivityFeed |
| `components/providers/RealtimeProvider.tsx` | Supabase Realtime subscriptions |

## Operational notes

- **Treasury balance**: keep at least `5 × 0.2 × N` SOL where `N` is the number of rounds you want to cover without topping up. ~50 SOL covers ~50 fully-claimed rounds.
- **Token-gate bypass**: the check happens server-side via Solana RPC. A wallet that proves the holding once can still transfer the tokens out afterwards and remain reserved — by design, per the simplest UX.
- **Cron failures**: the state machine is idempotent. If a tick fails, the next one resumes. Look for stuck rounds via `select * from rounds where status != 'completed'`.
- **Manual reconciliation**: failed payouts land in `payouts.status='failed'` after 3 attempts. Investigate `last_error`.
