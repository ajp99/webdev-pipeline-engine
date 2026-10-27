-- mutation: a gate artifact may be of the wrong type
select m.patch_fn($q$private.current_gate_artifact(uuid, uuid, int, text, boolean)$q$, $q$if art.type is distinct from private.stage_artifact(v.stage) then$q$, $q$if false then$q$);
