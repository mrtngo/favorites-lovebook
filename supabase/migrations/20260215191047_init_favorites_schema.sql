create extension if not exists pgcrypto;

create table if not exists public.important_dates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  event_date date not null,
  recurring boolean not null default true,
  note text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.favorite_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('gifts', 'destinations', 'flowers', 'dateIdeas', 'littleThings')),
  name text not null,
  details text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.user_notes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  notes text not null default '',
  updated_at timestamptz not null default now()
);

create or replace function public.set_user_notes_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_user_notes_updated_at on public.user_notes;
create trigger trg_user_notes_updated_at
before update on public.user_notes
for each row
execute function public.set_user_notes_updated_at();

create index if not exists idx_important_dates_user_id on public.important_dates(user_id);
create index if not exists idx_important_dates_event_date on public.important_dates(event_date);
create index if not exists idx_favorite_items_user_id on public.favorite_items(user_id);
create index if not exists idx_favorite_items_category on public.favorite_items(category);

alter table public.important_dates enable row level security;
alter table public.favorite_items enable row level security;
alter table public.user_notes enable row level security;

drop policy if exists "important_dates_select_own" on public.important_dates;
create policy "important_dates_select_own"
on public.important_dates
for select
using (auth.uid() = user_id);

drop policy if exists "important_dates_insert_own" on public.important_dates;
create policy "important_dates_insert_own"
on public.important_dates
for insert
with check (auth.uid() = user_id);

drop policy if exists "important_dates_update_own" on public.important_dates;
create policy "important_dates_update_own"
on public.important_dates
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "important_dates_delete_own" on public.important_dates;
create policy "important_dates_delete_own"
on public.important_dates
for delete
using (auth.uid() = user_id);

drop policy if exists "favorite_items_select_own" on public.favorite_items;
create policy "favorite_items_select_own"
on public.favorite_items
for select
using (auth.uid() = user_id);

drop policy if exists "favorite_items_insert_own" on public.favorite_items;
create policy "favorite_items_insert_own"
on public.favorite_items
for insert
with check (auth.uid() = user_id);

drop policy if exists "favorite_items_update_own" on public.favorite_items;
create policy "favorite_items_update_own"
on public.favorite_items
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "favorite_items_delete_own" on public.favorite_items;
create policy "favorite_items_delete_own"
on public.favorite_items
for delete
using (auth.uid() = user_id);

drop policy if exists "user_notes_select_own" on public.user_notes;
create policy "user_notes_select_own"
on public.user_notes
for select
using (auth.uid() = user_id);

drop policy if exists "user_notes_insert_own" on public.user_notes;
create policy "user_notes_insert_own"
on public.user_notes
for insert
with check (auth.uid() = user_id);

drop policy if exists "user_notes_update_own" on public.user_notes;
create policy "user_notes_update_own"
on public.user_notes
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "user_notes_delete_own" on public.user_notes;
create policy "user_notes_delete_own"
on public.user_notes
for delete
using (auth.uid() = user_id);
