-- mutation: a new change request may come decided
select m.patch_fn($q$guard_change_request()$q$, $q$if new.status <> 'received' or new.decision is not null$q$, $q$if false$q$);
