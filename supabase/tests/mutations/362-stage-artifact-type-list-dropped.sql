-- mutation: complete_stage_artifact accepts any artifact type of the stage
select m.patch_fn($q$complete_stage_artifact(uuid, uuid, text, public.artifact_type, jsonb, text)$q$, $q$if p_type not in ('prd', 'plan', 'prototype') or private.artifact_stage(p_type) is distinct from proj.stage then$q$, $q$if private.artifact_stage(p_type) is distinct from proj.stage then$q$);
