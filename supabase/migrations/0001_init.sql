-- Lotto Coin schema — token-gated entry model.
-- Apply via: paste into the Supabase SQL editor and run on a fresh database.
--
-- Concept:
--   * 5-minute rounds, 100 numbers per round.
--   * Entry is token-gated: a wallet must hold >= LOTTO_MIN_TOKEN_AMOUNT_UI
--     of the project SPL token. The reservation endpoint verifies this over
--     Solana RPC then atomically flips the number from 'available' to
--     'reserved'. No deposits, no webhooks, no sweeps, no refunds.
--   * One pick per wallet per round (enforced via a partial unique index).
--   * After the timer, 5 winners are drawn from a finalized blockhash and
--     each receives PAYOUT_LAMPORTS (0.2 SOL) from the treasury.

create extension if not exists pgcrypto;

----------------------------------------------------------------
-- rounds: one row per 5-minute round
----------------------------------------------------------------
create table if not exists rounds (
  id                bigserial primary key,
  status            text not null check (status in ('upcoming','active','drawing','settling','completed')),
  starts_at         timestamptz not null,
  ends_at           timestamptz not null,
  draw_seed_slot    bigint,
  draw_blockhash    text,
  winning_numbers   smallint[],
  helius_webhook_id text,
  created_at        timestamptz not null default now(),
  constraint rounds_winning_numbers_count
    check (winning_numbers is null or array_length(winning_numbers, 1) = 5)
);

-- Only one round can be live at a time. 'drawing'/'settling' are accepted
-- as legacy values so historic rows from the old state machine still
-- satisfy the check; the current state machine only uses upcoming/active/
-- completed.
create unique index if not exists one_live_round
  on rounds ((1)) where status in ('active','drawing','settling');

----------------------------------------------------------------
-- numbers: 100 rows per round, one per ball (1..100)
----------------------------------------------------------------
create table if not exists numbers (
  id               bigserial primary key,
  round_id         bigint not null references rounds(id) on delete cascade,
  n                smallint not null check (n between 1 and 100),
  status           text not null check (status in ('available','reserved','expired')),
  -- Wallet that proved the token holding (also the payout destination).
  holding_wallet   text,
  payout_wallet    text,
  reserved_at      timestamptz,
  is_winner        boolean not null default false,
  unique (round_id, n)
);
create index if not exists numbers_round_status_idx on numbers (round_id, status);

-- Hard DB-level "one pick per wallet per round" guarantee.
create unique index if not exists numbers_one_per_wallet_per_round
  on numbers (round_id, payout_wallet)
  where status = 'reserved';

----------------------------------------------------------------
-- payouts: one per winning reserved number
----------------------------------------------------------------
create table if not exists payouts (
  id              bigserial primary key,
  round_id        bigint not null references rounds(id),
  number_id       bigint not null references numbers(id),
  payout_wallet   text not null,
  amount_lamports bigint not null,
  status          text not null check (status in ('pending','sent','failed')) default 'pending',
  tx_signature    text,
  attempts        int not null default 0,
  last_error      text,
  created_at      timestamptz not null default now(),
  unique (number_id)
);
create index if not exists payouts_status_idx on payouts (status, created_at);

----------------------------------------------------------------
-- Realtime: publish numbers + rounds so the browser can subscribe
----------------------------------------------------------------
alter publication supabase_realtime add table numbers;
alter publication supabase_realtime add table rounds;

----------------------------------------------------------------
-- RLS: lock everything down; expose only safe columns via views
----------------------------------------------------------------
alter table rounds  enable row level security;
alter table numbers enable row level security;
alter table payouts enable row level security;

-- Public can read rounds (all columns are non-sensitive).
create policy "rounds_select_public" on rounds for select using (true);

-- Public can read numbers — Realtime needs base-table grants. Sensitive
-- columns (payout_wallet, holding_wallet) are redacted via the
-- public_numbers / public_feed views below; the API layer also avoids
-- selecting them on public endpoints.
create policy "numbers_select_public" on numbers for select using (true);

----------------------------------------------------------------
-- Safe public view: used by the browser for HTTP fetches.
-- Strips payout/holding wallet from the basic number list.
----------------------------------------------------------------
create or replace view public_numbers as
  select id, round_id, n, status, is_winner
  from numbers;

grant select on public_numbers to anon, authenticated;

----------------------------------------------------------------
-- Activity-feed view: shows reserved picks plus payout info.
-- payout_wallet is exposed (this is on-chain anyway via the payout tx).
----------------------------------------------------------------
create or replace view public_feed as
  select
    nu.id            as number_id,
    nu.round_id,
    nu.n,
    nu.status,
    nu.is_winner,
    nu.payout_wallet as sender_wallet,
    nu.reserved_at,
    p.tx_signature   as payout_signature,
    p.status         as payout_status
  from numbers nu
  left join payouts p on p.number_id = nu.id
  where nu.status = 'reserved';

grant select on public_feed to anon, authenticated;
