-- mutation: accept_gate ignores the order of the gates
select m.patch_fn($q$accept_gate(uuid, gate_type, uuid, text, int)$q$, $q$e.gate_type < p_gate$q$, $q$false$q$);
