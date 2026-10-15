-- mutation: a client may change who asked a question
select m.patch_fn($q$guard_intake_response_update()$q$, $q$new.round, new.question_id, new.asked_by)$q$, $q$new.round, new.question_id)$q$);
select m.patch_fn($q$guard_intake_response_update()$q$, $q$old.round, old.question_id, old.asked_by)$q$, $q$old.round, old.question_id)$q$);
