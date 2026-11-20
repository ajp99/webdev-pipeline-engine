-- mutation: complete_stage_artifact accepts another project's run
select m.patch_fn($q$complete_stage_artifact(uuid, uuid, text, public.artifact_type, jsonb, text)$q$, $q$if not found or run.project_id <> p_project then$q$, $q$if not found then$q$);
