-- mutation: complete_stage_artifact accepts a paused project
select m.patch_fn($q$complete_stage_artifact(uuid, uuid, text, public.artifact_type, jsonb, text, jsonb, text)$q$, $q$if proj.status <> 'active' then$q$, $q$if false then$q$);
