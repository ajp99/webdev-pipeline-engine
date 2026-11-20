-- mutation: complete_stage_artifact does not check for the worker role
select m.patch_fn($q$complete_stage_artifact(uuid, uuid, text, public.artifact_type, jsonb, text, jsonb, text)$q$, $q$if auth.role() is distinct from 'service_role' then$q$, $q$if false then$q$);
