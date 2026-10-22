-- mutation: a follow-up text may be any JSON value
select m.patch_fn($q$complete_intake_review(uuid, int, text, jsonb, jsonb, text)$q$, $q$jsonb_typeof(f->'text') is distinct from 'string'$q$, $q$false$q$);
