-- mutation: a project may be created at any stage
select m.patch_fn($q$guard_project_write()$q$, $q$new.stage <> 'intake' or$q$, $q$false or$q$);
