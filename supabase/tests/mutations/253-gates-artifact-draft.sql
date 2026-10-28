-- mutation: a gate artifact may be approved, rejected or superseded
select m.patch_fn($q$private.current_gate_artifact(uuid, uuid, int, text)$q$, $q$if art.status <> 'draft' then$q$, $q$if false then$q$);
