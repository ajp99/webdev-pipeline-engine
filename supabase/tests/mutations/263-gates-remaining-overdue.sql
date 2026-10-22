-- mutation: a late gate is never overdue
select m.patch_fn($q$remaining_gates(uuid)$q$, $q$(not pending and now() > s + make_interval(hours => g.escalate_after_hours))$q$, $q$false$q$);
