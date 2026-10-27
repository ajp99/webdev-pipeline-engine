-- mutation: accept and reject act on a rejected version
select m.patch_fn($q$private.current_gate_artifact(uuid, uuid, int, text, boolean)$q$, $q$not (p_rejected_ok and art.status = 'rejected')$q$, $q$not (art.status = 'rejected')$q$);
