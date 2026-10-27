-- mutation: feedback refuses a rejected version
select m.patch_fn($q$feedback_gate(uuid, uuid, text, int)$q$, $q$'feedback_gate', true)$q$, $q$'feedback_gate', false)$q$);
