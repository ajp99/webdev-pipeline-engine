-- mutation: a summary may be huge
select m.patch_fn($q$complete_intake_review(uuid, int, text, jsonb, jsonb, text)$q$, $q$length(p_summary) > 1500 or$q$, $q$length(p_summary) > 150000 or$q$);
