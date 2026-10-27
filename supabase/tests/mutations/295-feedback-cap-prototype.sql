-- mutation: the prototype cap is wrong
select m.patch_fn($q$private.feedback_cap(public.artifact_type)$q$, $q$when 'prototype' then 2$q$, $q$when 'prototype' then 9$q$);
