-- mutation: a missing answer is taken as a denial
select m.patch_fn($q$decide_run_approval(uuid, boolean)$q$, $q$if p_approve is null then$q$, $q$if false then$q$);
