-- mutation: the immutability guard ignores content changes
select m.patch_fn($q$guard_artifact_immutable()$q$, $q$new.version, new.content, new.created_at$q$, $q$new.version, old.content, new.created_at$q$);
