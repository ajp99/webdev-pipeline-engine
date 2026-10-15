-- mutation: a client may change the question of a response
select m.patch_fn($q$guard_intake_response_update()$q$, $q$new.round, new.question_id, new.asked_by)$q$, $q$new.round, new.asked_by)$q$);
select m.patch_fn($q$guard_intake_response_update()$q$, $q$old.round, old.question_id, old.asked_by)$q$, $q$old.round, old.asked_by)$q$);
