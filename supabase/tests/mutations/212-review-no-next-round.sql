-- mutation: follow-ups do not open the next round
select m.patch_fn($q$complete_intake_review(uuid, int, text, jsonb, jsonb, text)$q$, $q$if n > 0 then$q$, $q$if false then$q$);
