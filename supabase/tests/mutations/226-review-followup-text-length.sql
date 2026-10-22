-- mutation: a follow-up text may be huge
select m.patch_fn($q$complete_intake_review(uuid, int, text, jsonb, jsonb, text)$q$, $q$length(f->>'text') > 500$q$, $q$length(f->>'text') > 50000$q$);
