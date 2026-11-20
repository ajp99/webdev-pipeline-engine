-- mutation: an artifact may be written with the model name stub, which marks a stub run
select m.patch_fn($q$complete_stage_artifact(uuid, uuid, text, public.artifact_type, jsonb, text, jsonb, text)$q$, $q$if p_model = 'stub' then$q$, $q$if false then$q$);
