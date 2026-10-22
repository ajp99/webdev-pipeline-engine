-- mutation: the next round opens even with no follow-ups
select m.patch_fn($q$complete_intake_review(uuid, int, text, jsonb, jsonb, text)$q$, $q$if n > 0 then$q$, $q$if true then$q$);
