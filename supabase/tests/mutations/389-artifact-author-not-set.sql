-- mutation: the database does not set the author
select m.patch_fn($q$guard_artifact_insert()$q$, $q$new.created_by := auth.uid();$q$, $q$null;$q$);
