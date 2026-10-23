-- mutation: a rejected artifact is shown as current
select m.patch_fn($q$remaining_gates(uuid)$q$, $q$if not found or art.status in ('superseded', 'rejected') then$q$, $q$if not found then$q$);
