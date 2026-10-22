-- mutation: remaining_gates lists paused projects
select m.patch_fn($q$remaining_gates(uuid)$q$, $q$where p.status = 'active' and p.stage <> 'closed' and$q$, $q$where p.stage <> 'closed' and$q$);
