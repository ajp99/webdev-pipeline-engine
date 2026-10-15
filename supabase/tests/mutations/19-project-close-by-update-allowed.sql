-- mutation: status may move to or from closed by a plain update
select m.patch_fn($q$guard_project_write()$q$, $q$(new.status = 'closed') is distinct from (old.status = 'closed')$q$, $q$false$q$);
