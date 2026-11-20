-- mutation: complete_stage_artifact accepts a run of another stage
select m.patch_fn($q$complete_stage_artifact(uuid, uuid, text, public.artifact_type, jsonb, text, jsonb, text)$q$, $q$if run.status <> 'running' or run.stage is distinct from proj.stage then$q$, $q$if run.status <> 'running' then$q$);
