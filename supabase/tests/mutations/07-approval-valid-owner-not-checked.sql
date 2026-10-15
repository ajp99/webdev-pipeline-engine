-- mutation: approval_is_valid accepts any giver for the owner role
select m.patch_fn($q$private.approval_is_valid(public.approvals,uuid)$q$, $q$exists (select 1 from public.owners o where o.id = ap.approved_by)$q$, $q$true$q$);
