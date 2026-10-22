-- mutation: a global gate row wins over the project's
select m.patch_fn($q$private.effective_gates(uuid, stage)$q$, $q$order by g.gate_type, g.project_id nulls last$q$, $q$order by g.gate_type, g.project_id nulls first$q$);
