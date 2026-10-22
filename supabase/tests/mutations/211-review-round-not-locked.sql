-- mutation: the reviewed round stays submitted
select m.patch_fn($q$complete_intake_review(uuid, int, text, jsonb, jsonb, text)$q$, $q$set status = 'reviewed', reviewed_at = now()$q$, $q$set reviewed_at = now()$q$);
