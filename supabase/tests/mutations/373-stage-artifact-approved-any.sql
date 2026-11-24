-- mutation: complete_stage_artifact refuses when any older version is approved
select m.patch_fn($q$complete_stage_artifact(uuid, uuid, text, public.artifact_type, jsonb, text, jsonb, text)$q$, $q$and a.version = (select max(b.version) from public.artifacts b where b.project_id = p_project and b.type = p_type
                          and (p_type <> 'round_summary' or b.content->'round' = p_content->'round'))$q$, $q$and true$q$);
