-- mutation: remaining_gates accepts anyone
select m.patch_fn($q$remaining_gates(uuid)$q$, $q$raise exception 'remaining_gates: not allowed';$q$, $q$null;$q$);
