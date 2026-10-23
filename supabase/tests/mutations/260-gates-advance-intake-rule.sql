-- mutation: advance_stage ignores the intake rule
select m.patch_fn($q$private.advance_blocker(uuid)$q$, $q$ib := private.intake_blocker(p_project);$q$, $q$ib := null;$q$);
