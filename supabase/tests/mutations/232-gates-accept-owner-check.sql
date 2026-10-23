-- mutation: accept_gate accepts anyone
select m.patch_fn($q$accept_gate(uuid, gate_type, uuid, text, int)$q$, $q$raise exception 'accept_gate: not allowed';$q$, $q$null;$q$);
