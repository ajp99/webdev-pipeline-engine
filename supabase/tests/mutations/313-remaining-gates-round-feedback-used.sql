-- mutation: remaining_gates reports no loops for a round
select m.patch_fn($q$remaining_gates(uuid)$q$, $q$fu := private.feedback_used(pr.id, 'round_summary', rd.number);$q$, $q$fu := 0;$q$);
