-- mutation: the report cap is wrong
select m.patch_fn($q$private.feedback_cap(public.artifact_type)$q$, $q$when 'report'    then 2$q$, $q$when 'report'    then 9$q$);
