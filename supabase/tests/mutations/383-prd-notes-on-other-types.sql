-- mutation: a plan may carry notes
select m.patch_fn($q$complete_stage_artifact(uuid, uuid, text, public.artifact_type, jsonb, text, jsonb, text)$q$, $q$elsif p_notes is not null then$q$, $q$elsif false then$q$);
