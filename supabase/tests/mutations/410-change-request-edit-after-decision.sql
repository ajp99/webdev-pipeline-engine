-- mutation: a decided change request can be edited
select m.patch_fn($q$guard_change_request()$q$, $q$if old.status <> 'received' then$q$, $q$if false then$q$);
