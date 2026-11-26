-- mutation: summary-any-round
select m.patch_fn($q$complete_stage_artifact(uuid, uuid, text, public.artifact_type, jsonb, text, jsonb, text)$q$, $q$if jsonb_typeof(p_content->'round') is distinct from 'number' or$q$, $q$if false and$q$);
