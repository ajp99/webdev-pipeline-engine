-- mutation: complete_stage_artifact does not record the model and prompt hash on the run
select m.patch_fn($q$complete_stage_artifact(uuid, uuid, text, public.artifact_type, jsonb, text, jsonb, text)$q$, $q$update public.stage_runs set model = p_model, prompt_hash = p_prompt_hash where id = p_run;$q$, $q$null;$q$);
