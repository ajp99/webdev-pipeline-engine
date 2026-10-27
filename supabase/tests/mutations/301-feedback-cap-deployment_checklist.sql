-- mutation: the deployment_checklist cap is wrong
select m.patch_fn($q$private.feedback_cap(public.artifact_type)$q$, $q$when 'deployment_checklist' then 3$q$, $q$when 'deployment_checklist' then 9$q$);
