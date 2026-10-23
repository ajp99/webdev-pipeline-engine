-- mutation: accept_gate works in a paused project
select m.patch_fn($q$accept_gate(uuid, gate_type, uuid, text, int)$q$, $q$if v.status <> 'active' then$q$, $q$if false then$q$);
