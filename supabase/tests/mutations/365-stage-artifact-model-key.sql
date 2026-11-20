-- mutation: complete_stage_artifact lets the content set model
select m.patch_fn($q$complete_stage_artifact(uuid, uuid, text, public.artifact_type, jsonb, text)$q$, $q$if p_content ? 'model' then$q$, $q$if false then$q$);
