-- mutation: complete_stage_artifact refuses when any older version is approved
select m.patch_fn($q$complete_stage_artifact(uuid, uuid, text, public.artifact_type, jsonb, text)$q$, $q$and a.version = (select max(b.version) from public.artifacts b where b.project_id = p_project and b.type = p_type)$q$, $q$and true$q$);
