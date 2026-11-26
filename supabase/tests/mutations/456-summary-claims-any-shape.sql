-- mutation: summary-claims-any-shape
select m.patch_fn($q$complete_stage_artifact(uuid, uuid, text, public.artifact_type, jsonb, text, jsonb, text)$q$, $q$if jsonb_typeof(coalesce(p_content->'claims', '[]'::jsonb)) <> 'array' then$q$, $q$if false then$q$);
