-- mutation: accept_gate queues a run for every stage
select m.patch_fn($q$accept_gate(uuid, gate_type, uuid, text, int)$q$, $q$if private.stage_has_agent(nxt) then$q$, $q$if true then$q$);
