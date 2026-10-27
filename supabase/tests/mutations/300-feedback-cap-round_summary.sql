-- mutation: the round_summary cap is wrong
select m.patch_fn($q$private.feedback_cap(public.artifact_type)$q$, $q$when 'round_summary' then 3$q$, $q$when 'round_summary' then 9$q$);
