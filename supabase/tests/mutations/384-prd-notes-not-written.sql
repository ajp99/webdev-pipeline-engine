-- mutation: the PRD notes are not stored
select m.patch_fn($q$complete_stage_artifact(uuid, uuid, text, public.artifact_type, jsonb, text, jsonb)$q$, $q$if p_type = 'prd' then
    update public.artifacts set status = 'superseded'
     where project_id = p_project and type = 'prd_notes'$q$, $q$if false then
    update public.artifacts set status = 'superseded'
     where project_id = p_project and type = 'prd_notes'$q$);
