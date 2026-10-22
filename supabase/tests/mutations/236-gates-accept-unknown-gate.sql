-- mutation: accept_gate takes a gate the stage does not have
select m.patch_fn($q$accept_gate(uuid, gate_type, uuid, text, int)$q$, $q$if gk is null then$q$, $q$if false then$q$);
