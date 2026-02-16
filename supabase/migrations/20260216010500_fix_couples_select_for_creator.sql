-- Allow couple creators to read their own newly inserted row immediately.
-- This prevents insert(...).select(...) from failing before couple_members is added.

drop policy if exists "couples_select_member" on public.couples;

create policy "couples_select_member"
on public.couples
for select
using (
  auth.uid() = created_by
  or public.is_member_of_couple(id)
);
