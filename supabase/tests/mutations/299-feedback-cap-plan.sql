-- mutation: the plan cap is wrong
select m.patch_fn($q$private.feedback_cap(public.artifact_type)$q$, $q$when 'plan' then 3$q$, $q$when 'plan' then 9$q$);
