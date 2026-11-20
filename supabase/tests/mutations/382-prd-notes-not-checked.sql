-- mutation: the PRD notes are not checked
select m.patch_fn($q$complete_stage_artifact(uuid, uuid, text, public.artifact_type, jsonb, text, jsonb)$q$, $q$problem := private.prd_notes_problem(p_notes);$q$, $q$problem := null;$q$);
