-- mutation: a review without a summary is accepted
select m.patch_fn($q$complete_intake_review(uuid, int, text, jsonb, jsonb, text)$q$, $q$if p_summary is null or btrim(p_summary) = '' then$q$, $q$if false then$q$);
