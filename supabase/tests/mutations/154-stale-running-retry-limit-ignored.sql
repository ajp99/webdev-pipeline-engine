-- mutation: stale running retry limit ignored (and the tidy step for exhausted queued runs off, so the limit is tested alone)
select m.patch_fn($q$claim_run(text)$q$, $q$case when attempts < 2 then 'queued'::public.run_status else 'failed'::public.run_status end$q$, $q$'queued'::public.run_status$q$);
select m.patch_fn($q$claim_run(text)$q$, $q$where status = 'queued' and attempts >= 2;$q$, $q$where false;$q$);
