-- mutation: complete_stage_artifact leaves older drafts as drafts
select m.patch_fn($q$complete_stage_artifact(uuid, uuid, text, public.artifact_type, jsonb, text, jsonb, text)$q$, $q$set status = 'superseded'
   where project_id = p_project and type = p_type$q$, $q$set status = 'draft'
   where project_id = p_project and type = p_type$q$);
