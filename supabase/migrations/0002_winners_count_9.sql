-- Bump winning_numbers from 5 to 9 per round.
-- Apply via: supabase db push  (or paste into the Supabase SQL editor)

alter table rounds drop constraint if exists rounds_winning_numbers_check;
alter table rounds drop constraint if exists rounds_check;
alter table rounds drop constraint if exists rounds_winning_numbers_count;

alter table rounds
  add constraint rounds_winning_numbers_count
  check (winning_numbers is null or array_length(winning_numbers, 1) = 9);
