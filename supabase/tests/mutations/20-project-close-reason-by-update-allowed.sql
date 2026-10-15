-- mutation: close_reason may change by a plain update
select m.patch_fn($q$guard_project_write()$q$, $q$or new.close_reason is distinct from old.close_reason$q$, $q$$q$);
