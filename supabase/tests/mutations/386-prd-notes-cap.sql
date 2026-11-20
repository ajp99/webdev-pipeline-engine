-- mutation: the notes have no item cap
select m.patch_fn($q$private.prd_notes_problem(jsonb)$q$, $q$jsonb_array_length(c -> k) > 50$q$, $q$false$q$);
