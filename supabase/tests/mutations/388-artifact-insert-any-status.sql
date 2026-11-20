-- mutation: an artifact may be inserted approved through the API
select m.patch_fn($q$guard_artifact_insert()$q$, $q$if new.status <> 'draft' then$q$, $q$if false then$q$);
