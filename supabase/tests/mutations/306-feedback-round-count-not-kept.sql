-- mutation: rounds.feedback_count is not kept
select m.patch_fn($q$feedback_gate(uuid, uuid, text, int)$q$, $q$set feedback_count = feedback_count + 1$q$, $q$set feedback_count = feedback_count$q$);
