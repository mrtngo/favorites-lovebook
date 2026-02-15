-- Shared visibility, per-user ownership.

create or replace function public.is_member_of_couple(target_couple uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.couple_members cm
    where cm.couple_id = target_couple
      and cm.user_id = auth.uid()
  );
$$;

create or replace function public.users_share_couple(user_a uuid, user_b uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.couple_members a
    join public.couple_members b
      on a.couple_id = b.couple_id
    where a.user_id = user_a
      and b.user_id = user_b
  );
$$;

grant execute on function public.is_member_of_couple(uuid) to authenticated;
grant execute on function public.users_share_couple(uuid, uuid) to authenticated;

-- couple_members policies: avoid recursion and allow members to see member list.
drop policy if exists "couple_members_select_self" on public.couple_members;
drop policy if exists "couple_members_insert_self_for_owned_couple" on public.couple_members;
drop policy if exists "couple_members_delete_self_or_creator" on public.couple_members;

create policy "couple_members_select_same_couple"
on public.couple_members
for select
using (public.is_member_of_couple(couple_id));

create policy "couple_members_insert_self_for_owned_couple"
on public.couple_members
for insert
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.couples c
    where c.id = couple_id
      and c.created_by = auth.uid()
  )
);

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

-- important_dates: visible to both members, mutable only by creator.
drop policy if exists "important_dates_select_own" on public.important_dates;
drop policy if exists "important_dates_insert_own" on public.important_dates;
drop policy if exists "important_dates_update_own" on public.important_dates;
drop policy if exists "important_dates_delete_own" on public.important_dates;

create policy "important_dates_select_shared"
on public.important_dates
for select
using (public.is_member_of_couple(couple_id));

create policy "important_dates_insert_owner"
on public.important_dates
for insert
with check (
  auth.uid() = user_id
  and public.is_member_of_couple(couple_id)
);

create policy "important_dates_update_owner"
on public.important_dates
for update
using (
  auth.uid() = user_id
  and public.is_member_of_couple(couple_id)
)
with check (
  auth.uid() = user_id
  and public.is_member_of_couple(couple_id)
);

create policy "important_dates_delete_owner"
on public.important_dates
for delete
using (
  auth.uid() = user_id
  and public.is_member_of_couple(couple_id)
);

-- favorite_items: visible to both members, mutable only by creator.
drop policy if exists "favorite_items_select_own" on public.favorite_items;
drop policy if exists "favorite_items_insert_own" on public.favorite_items;
drop policy if exists "favorite_items_update_own" on public.favorite_items;
drop policy if exists "favorite_items_delete_own" on public.favorite_items;

create policy "favorite_items_select_shared"
on public.favorite_items
for select
using (public.is_member_of_couple(couple_id));

create policy "favorite_items_insert_owner"
on public.favorite_items
for insert
with check (
  auth.uid() = user_id
  and public.is_member_of_couple(couple_id)
);

create policy "favorite_items_update_owner"
on public.favorite_items
for update
using (
  auth.uid() = user_id
  and public.is_member_of_couple(couple_id)
)
with check (
  auth.uid() = user_id
  and public.is_member_of_couple(couple_id)
);

create policy "favorite_items_delete_owner"
on public.favorite_items
for delete
using (
  auth.uid() = user_id
  and public.is_member_of_couple(couple_id)
);

-- user_notes: each user writes their own note, couple partner can read.
drop policy if exists "user_notes_select_own" on public.user_notes;
drop policy if exists "user_notes_insert_own" on public.user_notes;
drop policy if exists "user_notes_update_own" on public.user_notes;
drop policy if exists "user_notes_delete_own" on public.user_notes;

create policy "user_notes_select_shared"
on public.user_notes
for select
using (
  auth.uid() = user_id
  or public.users_share_couple(auth.uid(), user_id)
);

create policy "user_notes_insert_owner"
on public.user_notes
for insert
with check (auth.uid() = user_id);

create policy "user_notes_update_owner"
on public.user_notes
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "user_notes_delete_owner"
on public.user_notes
for delete
using (auth.uid() = user_id);
