-- mutation: approval_is_valid accepts any giver for the owner role
select m.patch_fn($q$approval_is_valid(approvals,uuid)$q$, $q$exists (select 1 from owners o where o.id = ap.approved_by)$q$, $q$true$q$);
