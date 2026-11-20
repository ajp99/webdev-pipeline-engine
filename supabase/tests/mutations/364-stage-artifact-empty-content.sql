-- mutation: complete_stage_artifact accepts an empty or non-object content
select m.patch_fn($q$complete_stage_artifact(uuid, uuid, text, public.artifact_type, jsonb, text)$q$, $q$if p_content is null or jsonb_typeof(p_content) <> 'object' or p_content = '{}'::jsonb then$q$, $q$if p_content is null then$q$);
