-- mutation: the intake_record cap is wrong
select m.patch_fn($q$private.feedback_cap(public.artifact_type)$q$, $q$when 'intake_record' then 3$q$, $q$when 'intake_record' then 9$q$);
