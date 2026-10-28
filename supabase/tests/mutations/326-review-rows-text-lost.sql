-- mutation: follow-up rows get the id as text
select m.patch_fn($q$complete_intake_review(uuid, int, text, jsonb, jsonb, text)$q$, $q$null, 'agent', f->>'text'$q$, $q$null, 'agent', f->>'id'$q$);
