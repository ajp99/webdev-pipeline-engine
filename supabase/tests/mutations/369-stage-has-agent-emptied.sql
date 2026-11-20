-- mutation: no stage auto-queues a run on entry
select m.patch_fn($q$private.stage_has_agent(public.stage)$q$, $q$array['requirements', 'plan', 'prototype']$q$, $q$array[]$q$);
