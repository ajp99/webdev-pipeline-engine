-- mutation: missing gaps (null) slip through
select m.patch_fn($q$complete_intake_review(uuid, int, text, jsonb, jsonb, text)$q$, $q$if p_gaps is null or jsonb_typeof(p_gaps) <> 'array' then$q$, $q$if jsonb_typeof(p_gaps) <> 'array' then$q$);
