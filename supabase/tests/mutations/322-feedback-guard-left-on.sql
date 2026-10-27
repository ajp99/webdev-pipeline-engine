-- mutation: feedback_gate leaves the round guard off
select m.patch_fn($q$feedback_gate(uuid, uuid, text, int)$q$, $q$perform set_config('app.gate_feedback', 'off', true);$q$, $q$null;$q$);
