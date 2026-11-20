-- mutation: an API role may insert a PRD directly
select m.patch_fn($q$guard_artifact_insert()$q$, $q$if new.type in ('prd', 'prd_notes') then$q$, $q$if false then$q$);
