-- mutation: stale running never requeued
select m.patch_fn($q$claim_run(text)$q$, $q$case when attempts < 2 then 'queued'::public.run_status else 'failed'::public.run_status end$q$, $q$'failed'::public.run_status$q$);
