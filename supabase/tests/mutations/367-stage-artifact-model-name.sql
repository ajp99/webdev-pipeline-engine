-- mutation: complete_stage_artifact accepts a missing or long model name
select m.patch_fn($q$complete_stage_artifact(uuid, uuid, text, public.artifact_type, jsonb, text)$q$, $q$if p_model is null or btrim(p_model) = '' or length(p_model) > 100 then$q$, $q$if false then$q$);
