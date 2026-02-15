-- Fix RLS recursion on couple_members and provide secure invite-based join RPC.

-- Remove recursive policies.
drop policy if exists "couple_members_select_member" on public.couple_members;
drop policy if exists "couple_members_insert_self" on public.couple_members;
drop policy if exists "couple_members_delete_self_or_creator" on public.couple_members;

-- Replace with non-recursive policies.
create policy "couple_members_select_self"
on public.couple_members
for select
using (auth.uid() = user_id);

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

create or replace function public.join_couple_by_invite(invite text)
returns table(couple_id uuid, couple_name text, invite_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_couple public.couples%rowtype;
  uid uuid;
  current_couple uuid;
begin
  uid := auth.uid();

  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select *
  into target_couple
  from public.couples
  where upper(invite_code) = upper(trim(invite))
  limit 1;

  if target_couple.id is null then
    raise exception 'Invite code not found';
  end if;

  select cm.couple_id
  into current_couple
  from public.couple_members cm
  where cm.user_id = uid
  limit 1;

  if current_couple is not null and current_couple <> target_couple.id then
    raise exception 'You already belong to another couple';
  end if;

  insert into public.couple_members (couple_id, user_id)
  values (target_couple.id, uid)
  on conflict (couple_id, user_id) do nothing;

  return query
  select target_couple.id, target_couple.name, target_couple.invite_code;
end;
$$;

grant execute on function public.join_couple_by_invite(text) to authenticated;
