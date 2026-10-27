-- mutation: a gate artifact may be an old version
select m.patch_fn($q$private.current_gate_artifact(uuid, uuid, int, text, boolean)$q$, $q$if art.version <> newest then$q$, $q$if false then$q$);
