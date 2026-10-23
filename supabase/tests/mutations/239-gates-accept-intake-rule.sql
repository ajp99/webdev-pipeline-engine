-- mutation: accept_gate ignores the intake rule
select m.patch_fn($q$accept_gate(uuid, gate_type, uuid, text, int)$q$, $q$blocker := private.intake_blocker(p_project);$q$, $q$blocker := null;$q$);
