-- Public activity-feed view: exposes already-on-chain data (sender wallet,
-- deposit signature, payout signature) for the live picks/winners feed.
-- Apply via: supabase db push  (or paste into the Supabase SQL editor)

create or replace view public_feed as
  select
    nu.id            as number_id,
    nu.round_id,
    nu.n,
    nu.status,
    nu.is_winner,
    nu.sender_wallet,
    nu.reserved_at,
    nu.tx_signature  as deposit_signature,
    p.tx_signature   as payout_signature,
    p.status         as payout_status
  from numbers nu
  left join payouts p on p.number_id = nu.id
  where nu.status = 'reserved';

grant select on public_feed to anon, authenticated;
