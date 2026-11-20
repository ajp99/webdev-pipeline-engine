-- mutation: a paused project takes change requests
select m.patch_fn($q$guard_change_request()$q$, $q$if proj.status <> 'active' then$q$, $q$if false then$q$);
