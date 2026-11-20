-- mutation: complete_stage_artifact does not check which worker claimed the run
select m.patch_fn($q$complete_stage_artifact(uuid, uuid, text, public.artifact_type, jsonb, text, jsonb)$q$, $q$if p_worker is null or run.claimed_by is distinct from p_worker then$q$, $q$if false then$q$);
