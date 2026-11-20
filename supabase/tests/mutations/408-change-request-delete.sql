-- mutation: a change request can be deleted
select m.patch_fn($q$guard_change_request()$q$, $q$if tg_op = 'DELETE' then
    raise exception$q$, $q$if tg_op = 'DELETE' then
    return old;
    raise exception$q$);
