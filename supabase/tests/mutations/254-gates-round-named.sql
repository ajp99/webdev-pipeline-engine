-- mutation: a build round need not be named
select m.patch_fn($q$private.current_gate_artifact(uuid, uuid, int, text, boolean)$q$, $q$if p_round is null then$q$, $q$if false then$q$);
