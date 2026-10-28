-- mutation: a round number is taken outside build rounds
select m.patch_fn($q$private.current_gate_artifact(uuid, uuid, int, text)$q$, $q$if p_round is not null then$q$, $q$if false then$q$);
