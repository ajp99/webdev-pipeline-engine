-- mutation: a client sign-off advances the project
select m.patch_fn($q$accept_gate(uuid, gate_type, uuid, text, int)$q$, $q$if gk = 'client' then$q$, $q$if false then$q$);
