-- Avoid output-variable name collisions in join_couple_by_invite by returning
-- the couples row type instead of RETURNS TABLE(couple_id,...).

drop function if exists public.join_couple_by_invite(text);

create function public.join_couple_by_invite(invite text)
returns public.couples
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

  select c.*
  into target_couple
  from public.couples c
  where upper(c.invite_code) = upper(trim(invite))
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

  return target_couple;
end;
$$;

grant execute on function public.join_couple_by_invite(text) to authenticated;
