-- mutation: accept_gate takes a round that is not in review
select m.patch_fn($q$accept_gate(uuid, gate_type, uuid, text, int)$q$, $q$raise exception 'accept_gate: round % is not in review', p_round;$q$, $q$null;$q$);
