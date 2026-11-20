-- mutation: the API may change an artifact's status
select m.patch_fn($q$guard_artifact_immutable()$q$, $q$if new.status is distinct from old.status and$q$, $q$if false and$q$);
