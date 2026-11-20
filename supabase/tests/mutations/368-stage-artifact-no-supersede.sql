-- mutation: complete_stage_artifact leaves older drafts as drafts
select m.patch_fn($q$complete_stage_artifact(uuid, uuid, text, public.artifact_type, jsonb, text)$q$, $q$set status = 'superseded'$q$, $q$set status = 'draft'$q$);
