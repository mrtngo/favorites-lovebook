create table if not exists public.couples (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique default upper(substr(md5(gen_random_uuid()::text), 1, 8)),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.couple_members (
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (couple_id, user_id),
  unique (user_id)
);

alter table public.important_dates
add column if not exists couple_id uuid references public.couples(id) on delete cascade;

alter table public.favorite_items
add column if not exists couple_id uuid references public.couples(id) on delete cascade;

create table if not exists public.couple_notes (
  couple_id uuid primary key references public.couples(id) on delete cascade,
  notes text not null default '',
  updated_at timestamptz not null default now()
);

create or replace function public.set_couple_notes_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_couple_notes_updated_at on public.couple_notes;
create trigger trg_couple_notes_updated_at
before update on public.couple_notes
for each row
execute function public.set_couple_notes_updated_at();

create index if not exists idx_couple_members_user_id on public.couple_members(user_id);
create index if not exists idx_important_dates_couple_id on public.important_dates(couple_id);
create index if not exists idx_favorite_items_couple_id on public.favorite_items(couple_id);

-- Backfill: each existing user gets a single-member couple and all current records are mapped into it.
do $$
declare
  usr record;
  linked_couple uuid;
begin
  for usr in
    select distinct user_id
    from (
      select user_id from public.important_dates
      union
      select user_id from public.favorite_items
      union
      select user_id from public.user_notes
    ) all_users
    where user_id is not null
  loop
    linked_couple := null;

    select cm.couple_id
    into linked_couple
    from public.couple_members cm
    where cm.user_id = usr.user_id
    limit 1;

    if linked_couple is null then
      insert into public.couples (name, created_by)
      values ('Shared Space', usr.user_id)
      returning id into linked_couple;

      insert into public.couple_members (couple_id, user_id)
      values (linked_couple, usr.user_id)
      on conflict do nothing;
    end if;

    update public.important_dates
    set couple_id = linked_couple
    where user_id = usr.user_id and couple_id is null;

    update public.favorite_items
    set couple_id = linked_couple
    where user_id = usr.user_id and couple_id is null;

    insert into public.couple_notes (couple_id, notes)
    select linked_couple, un.notes
    from public.user_notes un
    where un.user_id = usr.user_id
    on conflict (couple_id) do update
      set notes = excluded.notes,
          updated_at = now();
  end loop;
end;
$$;

alter table public.couples enable row level security;
alter table public.couple_members enable row level security;
alter table public.couple_notes enable row level security;

-- couples

drop policy if exists "couples_select_member" on public.couples;
create policy "couples_select_member"
on public.couples
for select
using (
  exists (
    select 1
    from public.couple_members cm
    where cm.couple_id = couples.id
      and cm.user_id = auth.uid()
  )
);

drop policy if exists "couples_insert_creator" on public.couples;
create policy "couples_insert_creator"
on public.couples
for insert
with check (auth.uid() = created_by);

drop policy if exists "couples_update_member" on public.couples;
create policy "couples_update_member"
on public.couples
for update
using (
  exists (
    select 1
    from public.couple_members cm
    where cm.couple_id = couples.id
      and cm.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.couple_members cm
    where cm.couple_id = couples.id
      and cm.user_id = auth.uid()
  )
);

drop policy if exists "couples_delete_creator" on public.couples;
create policy "couples_delete_creator"
on public.couples
for delete
using (auth.uid() = created_by);

-- couple_members

drop policy if exists "couple_members_select_member" on public.couple_members;
create policy "couple_members_select_member"
on public.couple_members
for select
using (
  exists (
    select 1
    from public.couple_members me
    where me.couple_id = couple_members.couple_id
      and me.user_id = auth.uid()
  )
);

drop policy if exists "couple_members_insert_self" on public.couple_members;
create policy "couple_members_insert_self"
on public.couple_members
for insert
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.couples c
    where c.id = couple_id
  )
);

drop policy if exists "couple_members_delete_self_or_creator" on public.couple_members;
create policy "couple_members_delete_self_or_creator"
on public.couple_members
for delete
using (
  auth.uid() = user_id
  or exists (
    select 1
    from public.couples c
    where c.id = couple_members.couple_id
      and c.created_by = auth.uid()
  )
);

-- important_dates policies are replaced with couple-aware access

drop policy if exists "important_dates_select_own" on public.important_dates;
create policy "important_dates_select_own"
on public.important_dates
for select
using (
  (couple_id is not null and exists (
    select 1
    from public.couple_members cm
    where cm.couple_id = important_dates.couple_id
      and cm.user_id = auth.uid()
  ))
  or auth.uid() = user_id
);

drop policy if exists "important_dates_insert_own" on public.important_dates;
create policy "important_dates_insert_own"
on public.important_dates
for insert
with check (
  auth.uid() = user_id
  and (
    couple_id is null
    or exists (
      select 1
      from public.couple_members cm
      where cm.couple_id = important_dates.couple_id
        and cm.user_id = auth.uid()
    )
  )
);

drop policy if exists "important_dates_update_own" on public.important_dates;
create policy "important_dates_update_own"
on public.important_dates
for update
using (
  (couple_id is not null and exists (
    select 1
    from public.couple_members cm
    where cm.couple_id = important_dates.couple_id
      and cm.user_id = auth.uid()
  ))
  or auth.uid() = user_id
)
with check (
  (couple_id is not null and exists (
    select 1
    from public.couple_members cm
    where cm.couple_id = important_dates.couple_id
      and cm.user_id = auth.uid()
  ))
  or auth.uid() = user_id
);

drop policy if exists "important_dates_delete_own" on public.important_dates;
create policy "important_dates_delete_own"
on public.important_dates
for delete
using (
  (couple_id is not null and exists (
    select 1
    from public.couple_members cm
    where cm.couple_id = important_dates.couple_id
      and cm.user_id = auth.uid()
  ))
  or auth.uid() = user_id
);

-- favorite_items policies are replaced with couple-aware access

drop policy if exists "favorite_items_select_own" on public.favorite_items;
create policy "favorite_items_select_own"
on public.favorite_items
for select
using (
  (couple_id is not null and exists (
    select 1
    from public.couple_members cm
    where cm.couple_id = favorite_items.couple_id
      and cm.user_id = auth.uid()
  ))
  or auth.uid() = user_id
);

drop policy if exists "favorite_items_insert_own" on public.favorite_items;
create policy "favorite_items_insert_own"
on public.favorite_items
for insert
with check (
  auth.uid() = user_id
  and (
    couple_id is null
    or exists (
      select 1
      from public.couple_members cm
      where cm.couple_id = favorite_items.couple_id
        and cm.user_id = auth.uid()
    )
  )
);

drop policy if exists "favorite_items_update_own" on public.favorite_items;
create policy "favorite_items_update_own"
on public.favorite_items
for update
using (
  (couple_id is not null and exists (
    select 1
    from public.couple_members cm
    where cm.couple_id = favorite_items.couple_id
      and cm.user_id = auth.uid()
  ))
  or auth.uid() = user_id
)
with check (
  (couple_id is not null and exists (
    select 1
    from public.couple_members cm
    where cm.couple_id = favorite_items.couple_id
      and cm.user_id = auth.uid()
  ))
  or auth.uid() = user_id
);

drop policy if exists "favorite_items_delete_own" on public.favorite_items;
create policy "favorite_items_delete_own"
on public.favorite_items
for delete
using (
  (couple_id is not null and exists (
    select 1
    from public.couple_members cm
    where cm.couple_id = favorite_items.couple_id
      and cm.user_id = auth.uid()
  ))
  or auth.uid() = user_id
);

-- couple_notes

drop policy if exists "couple_notes_select_member" on public.couple_notes;
create policy "couple_notes_select_member"
on public.couple_notes
for select
using (
  exists (
    select 1
    from public.couple_members cm
    where cm.couple_id = couple_notes.couple_id
      and cm.user_id = auth.uid()
  )
);

drop policy if exists "couple_notes_insert_member" on public.couple_notes;
create policy "couple_notes_insert_member"
on public.couple_notes
for insert
with check (
  exists (
    select 1
    from public.couple_members cm
    where cm.couple_id = couple_notes.couple_id
      and cm.user_id = auth.uid()
  )
);

drop policy if exists "couple_notes_update_member" on public.couple_notes;
create policy "couple_notes_update_member"
on public.couple_notes
for update
using (
  exists (
    select 1
    from public.couple_members cm
    where cm.couple_id = couple_notes.couple_id
      and cm.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.couple_members cm
    where cm.couple_id = couple_notes.couple_id
      and cm.user_id = auth.uid()
  )
);

drop policy if exists "couple_notes_delete_member" on public.couple_notes;
create policy "couple_notes_delete_member"
on public.couple_notes
for delete
using (
  exists (
    select 1
    from public.couple_members cm
    where cm.couple_id = couple_notes.couple_id
      and cm.user_id = auth.uid()
  )
);
