-- mutation: PRD feedback may be re-authored or moved
select m.patch_fn($q$guard_prd_feedback()$q$, $q$if (new.created_by, new.artifact_id, new.project_id, new.created_at) is distinct from (old.created_by, old.artifact_id, old.project_id, old.created_at) then$q$, $q$if false then$q$);
