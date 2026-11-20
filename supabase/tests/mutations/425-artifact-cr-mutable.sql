-- mutation: the change request a version names can be changed
select m.patch_fn($q$guard_artifact_immutable()$q$, $q$new.created_by, new.change_request_id)
     is distinct from (old.id, old.project_id, old.type, old.version, old.content, old.created_at, old.created_by, old.change_request_id)$q$, $q$new.created_by)
     is distinct from (old.id, old.project_id, old.type, old.version, old.content, old.created_at, old.created_by)$q$);
