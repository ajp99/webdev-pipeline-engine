-- mutation: the worker may record change requests
select m.patch_fn($q$guard_change_request()$q$, $q$if not private.is_owner() then
    raise exception 'only the owner records change requests';$q$, $q$if false then
    raise exception 'only the owner records change requests';$q$);
