-- mutation: any number of gaps
select m.patch_fn($q$complete_intake_review(uuid, int, text, jsonb, jsonb, text)$q$, $q$if jsonb_array_length(p_gaps) > 40 then$q$, $q$if jsonb_array_length(p_gaps) > 4000 then$q$);
