-- mutation: complete_stage_artifact skips the PRD shape check
select m.patch_fn($q$complete_stage_artifact(uuid, uuid, text, public.artifact_type, jsonb, text, jsonb, text)$q$, $q$problem := private.prd_content_problem(p_content);$q$, $q$problem := null;$q$);
