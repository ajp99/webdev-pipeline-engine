-- mutation: the handover_guide cap is wrong
select m.patch_fn($q$private.feedback_cap(public.artifact_type)$q$, $q$when 'handover_guide' then 3$q$, $q$when 'handover_guide' then 9$q$);
