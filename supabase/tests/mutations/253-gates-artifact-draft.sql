-- mutation: a gate artifact may be approved, rejected or superseded
select m.patch_fn($q$private.current_gate_artifact(uuid, uuid, int, text, boolean)$q$, $q$if art.status <> 'draft' and not (p_rejected_ok and art.status = 'rejected') then$q$, $q$if false then$q$);
