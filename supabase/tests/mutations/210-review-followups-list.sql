-- mutation: follow-ups of any shape pass the first check
select m.patch_fn($q$complete_intake_review(uuid, int, text, jsonb, jsonb, text)$q$, $q$if p_followups is null or jsonb_typeof(p_followups) <> 'array' then$q$, $q$if false then$q$);
