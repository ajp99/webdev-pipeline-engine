-- mutation: the author of a version can be changed
select m.patch_fn($q$guard_artifact_immutable()$q$, $q$new.created_at, new.created_by)
     is distinct from (old.id, old.project_id, old.type, old.version, old.content, old.created_at, old.created_by)$q$, $q$new.created_at)
     is distinct from (old.id, old.project_id, old.type, old.version, old.content, old.created_at)$q$);
