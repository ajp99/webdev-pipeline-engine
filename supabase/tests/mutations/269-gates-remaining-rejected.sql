-- mutation: a rejected artifact is shown as current
select m.patch_fn($q$remaining_gates(uuid)$q$, $q$if not has_art or art.status in ('superseded', 'rejected') then$q$, $q$if not has_art then$q$);
