-- mutation: round 4 may ask for more follow-ups
select m.patch_fn($q$complete_intake_review(uuid, int, text, jsonb, jsonb, text)$q$, $q$if p_round >= 4 and n > 0 then$q$, $q$if false then$q$);
