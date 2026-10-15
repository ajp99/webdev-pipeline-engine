-- mutation: is_owner() returns true for everybody
select m.patch_fn($q$private.is_owner()$q$, $q$select exists (select 1 from public.owners where id = auth.uid())$q$, $q$select true$q$);
