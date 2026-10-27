-- mutation: a summary of another round is taken
select m.patch_fn($q$private.current_gate_artifact(uuid, uuid, int, text, boolean)$q$, $q$if art.type <> 'round_summary' or art.content ->> 'round' is distinct from p_round::text then$q$, $q$if false then$q$);
