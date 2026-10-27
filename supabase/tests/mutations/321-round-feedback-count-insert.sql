-- mutation: a new round can start with loops used
select m.patch_fn($q$guard_round_feedback_count()$q$, $q$(tg_op = 'INSERT' and new.feedback_count <> 0)$q$, $q$false$q$);
