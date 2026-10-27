-- mutation: feedback_gate does not open the round guard
select m.patch_fn($q$feedback_gate(uuid, uuid, text, int)$q$, $q$perform set_config('app.gate_feedback', 'on', true);$q$, $q$null;$q$);
