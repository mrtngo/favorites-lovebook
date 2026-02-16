-- Add per-member display names and reset all app data for a clean slate.

alter table public.couple_members
add column if not exists display_name text not null default '';

drop policy if exists "couple_members_update_self" on public.couple_members;
create policy "couple_members_update_self"
on public.couple_members
for update
using (
  auth.uid() = user_id
  and public.is_member_of_couple(couple_id)
)
with check (
  auth.uid() = user_id
  and public.is_member_of_couple(couple_id)
);

truncate table public.favorite_items,
  public.important_dates,
  public.user_notes,
  public.couple_notes,
  public.couple_members,
  public.couples
cascade;
