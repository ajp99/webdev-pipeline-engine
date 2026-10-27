-- mutation: the prd cap is wrong
select m.patch_fn($q$private.feedback_cap(public.artifact_type)$q$, $q$when 'prd' then 3$q$, $q$when 'prd' then 9$q$);
