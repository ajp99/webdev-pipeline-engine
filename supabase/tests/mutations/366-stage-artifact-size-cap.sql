-- mutation: complete_stage_artifact has no size cap
select m.patch_fn($q$complete_stage_artifact(uuid, uuid, text, public.artifact_type, jsonb, text, jsonb, text)$q$, $q$if length(p_content::text) > 100000 then$q$, $q$if false then$q$);
