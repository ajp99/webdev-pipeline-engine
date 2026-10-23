-- mutation: a build round can be accepted at a gate other than the soft one
select m.patch_fn($q$accept_gate(uuid, gate_type, uuid, text, int)$q$, $q$if p_gate <> 'soft' then$q$, $q$if false then$q$);
