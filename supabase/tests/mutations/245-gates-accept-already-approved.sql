-- mutation: accept_gate does not notice an approved gate
select m.patch_fn($q$accept_gate(uuid, gate_type, uuid, text, int)$q$, $q$raise exception 'accept_gate: the % gate is already approved on this version', p_gate;$q$, $q$null;$q$);
