-- mutation: no project is ready to advance
select m.patch_fn($q$remaining_gates(uuid)$q$, $q$ready := private.advance_blocker(pr.id) is null;$q$, $q$ready := false;$q$);
