-- mutation: any caller may complete a review
select m.patch_fn($q$complete_intake_review(uuid, int, text, jsonb, jsonb, text)$q$, $q$if auth.role() is distinct from 'service_role' then$q$, $q$if false then$q$);
