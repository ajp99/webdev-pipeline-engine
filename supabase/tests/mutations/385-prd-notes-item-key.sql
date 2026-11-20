-- mutation: a note item may carry other keys
select m.patch_fn($q$private.prd_notes_problem(jsonb)$q$, $q$or exists (select 1 from jsonb_object_keys(it) x where x not in ('issue', 'resolution'))$q$, $q$$q$);
