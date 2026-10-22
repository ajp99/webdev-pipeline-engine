-- mutation: two follow-ups may share an id
select m.patch_fn($q$complete_intake_review(uuid, int, text, jsonb, jsonb, text)$q$, $q$if (select count(distinct f->>'id') from jsonb_array_elements(p_followups) f) <> n then$q$, $q$if false then$q$);
