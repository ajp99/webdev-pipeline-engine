-- mutation: the API may write an agent question
select m.patch_fn($q$guard_intake_response()$q$, $q$if tg_op = 'INSERT' and new.asked_by = 'agent' then$q$, $q$if false then$q$);
