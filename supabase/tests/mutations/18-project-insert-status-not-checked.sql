-- mutation: a project may be created paused or closed
select m.patch_fn($q$guard_project_write()$q$, $q$new.status <> 'active' or$q$, $q$false or$q$);
