-- mutation: a cap of 0 does not turn Feedback off
select m.patch_fn($q$feedback_gate(uuid, uuid, text, int)$q$, $q$if cap = 0 then$q$, $q$if false then$q$);
