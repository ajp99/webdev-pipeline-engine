-- mutation: accept_gate advances with gates left
select m.patch_fn($q$accept_gate(uuid, gate_type, uuid, text, int)$q$, $q$if left_n > 0 then$q$, $q$if false then$q$);
