-- mutation: the immutability guard ignores version changes
select m.patch_fn($q$guard_artifact_immutable()$q$, $q$new.type, new.version, new.content$q$, $q$new.type, old.version, new.content$q$);
