-- mutation: summary-not-in-review
select m.patch_fn($q$complete_stage_artifact(uuid, uuid, text, public.artifact_type, jsonb, text, jsonb, text)$q$, $q$set status = 'in_review', claims$q$, $q$set claims$q$);
