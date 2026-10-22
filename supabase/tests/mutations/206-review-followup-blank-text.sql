-- mutation: a follow-up with blank text is accepted
select m.patch_fn($q$complete_intake_review(uuid, int, text, jsonb, jsonb, text)$q$, $q$or btrim(coalesce(f->>'text', '')) = ''$q$, $q$$q$);
