-- Lotto Coin initial schema
-- Apply via: supabase db push  (or paste into the Supabase SQL editor)

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
  check (winning_numbers is null or array_length(winning_numbers, 1) = 9)
);

-- only one round can be live at a time
create unique index if not exists one_live_round
  on rounds ((1)) where status in ('active','drawing','settling');

----------------------------------------------------------------
-- numbers: 100 rows per round, one per ball (1..100)
----------------------------------------------------------------
create table if not exists numbers (
  id               bigserial primary key,
  round_id         bigint not null references rounds(id) on delete cascade,
  n                smallint not null check (n between 1 and 100),
  deposit_address  text not null,
  derivation_index integer not null,
  status           text not null check (status in ('available','pending','reserved','expired')),
  pending_until    timestamptz,
  sender_wallet    text,
  payout_wallet    text,
  tx_signature     text,
  reserved_at      timestamptz,
  is_winner        boolean not null default false,
  unique (round_id, n),
  unique (tx_signature)
);
create index if not exists numbers_round_status_idx on numbers (round_id, status);
create index if not exists numbers_deposit_addr_idx on numbers (deposit_address);

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
-- sweeps: per-number sweep back to treasury after a round
----------------------------------------------------------------
create table if not exists sweeps (
  id              bigserial primary key,
  round_id        bigint not null references rounds(id),
  number_id       bigint not null references numbers(id),
  status          text not null check (status in ('pending','sent','failed','skipped')) default 'pending',
  tx_signature    text,
  attempts        int not null default 0,
  last_error      text,
  created_at      timestamptz not null default now(),
  unique (number_id)
);
create index if not exists sweeps_status_idx on sweeps (status, created_at);

----------------------------------------------------------------
-- refunds: queued refund for wrong-amount / late / over-limit deposits
----------------------------------------------------------------
create table if not exists refunds (
  id              bigserial primary key,
  round_id        bigint references rounds(id),
  deposit_address text not null,
  sender_wallet   text not null,
  amount_lamports bigint not null,
  reason          text not null,
  status          text not null check (status in ('pending','sent','failed')) default 'pending',
  tx_signature    text,
  attempts        int not null default 0,
  last_error      text,
  source_signature text unique,
  created_at      timestamptz not null default now()
);
create index if not exists refunds_status_idx on refunds (status, created_at);

----------------------------------------------------------------
-- sender_round_counts: enforces 5-numbers-per-sender-per-round
----------------------------------------------------------------
create table if not exists sender_round_counts (
  round_id      bigint not null references rounds(id) on delete cascade,
  sender_wallet text not null,
  count         int not null default 0 check (count between 0 and 5),
  primary key (round_id, sender_wallet)
);

----------------------------------------------------------------
-- Realtime: publish numbers + rounds so the browser can subscribe
----------------------------------------------------------------
alter publication supabase_realtime add table numbers;
alter publication supabase_realtime add table rounds;

----------------------------------------------------------------
-- RLS: lock everything down; expose only safe columns via views
----------------------------------------------------------------
alter table rounds              enable row level security;
alter table numbers             enable row level security;
alter table payouts             enable row level security;
alter table sweeps              enable row level security;
alter table refunds             enable row level security;
alter table sender_round_counts enable row level security;

-- public can read rounds (all columns are non-sensitive)
create policy "rounds_select_public" on rounds for select using (true);

-- public can read numbers BUT a separate view hides sensitive cols.
-- We still let SELECT on the table because Realtime needs base-table grants,
-- and we redact sensitive columns at the API layer / via a view for HTTP reads.
create policy "numbers_select_public" on numbers for select using (true);

-- everything else: service-role only (RLS denies anon by default once enabled)

----------------------------------------------------------------
-- Safe public view (used by the browser for HTTP fetches)
----------------------------------------------------------------
create or replace view public_numbers as
  select id, round_id, n, status, pending_until, is_winner
  from numbers;

grant select on public_numbers to anon, authenticated;
