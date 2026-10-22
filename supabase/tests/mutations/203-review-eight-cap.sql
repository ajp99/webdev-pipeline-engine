-- mutation: more than 8 follow-ups are accepted
select m.patch_fn($q$complete_intake_review(uuid, int, text, jsonb, jsonb, text)$q$, $q$if n > 8 then$q$, $q$if false then$q$);
