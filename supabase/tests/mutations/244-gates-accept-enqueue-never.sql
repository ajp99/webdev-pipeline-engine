-- mutation: accept_gate never queues a run
select m.patch_fn($q$accept_gate(uuid, gate_type, uuid, text, int)$q$, $q$if private.stage_has_agent(nxt) then$q$, $q$if false then$q$);
