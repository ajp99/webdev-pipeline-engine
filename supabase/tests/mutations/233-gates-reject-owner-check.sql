-- mutation: reject_gate accepts anyone
select m.patch_fn($q$reject_gate(uuid, uuid, int)$q$, $q$raise exception 'reject_gate: not allowed';$q$, $q$null;$q$);
