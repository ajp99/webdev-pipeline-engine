-- mutation: remaining_gates reports no loops used
select m.patch_fn($q$remaining_gates(uuid)$q$, $q$fu := private.feedback_used(pr.id, atype, null);$q$, $q$fu := 0;$q$);
