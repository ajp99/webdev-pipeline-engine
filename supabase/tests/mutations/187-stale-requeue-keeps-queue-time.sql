-- mutation: stale requeue keeps queue time
select m.patch_fn($q$claim_run(text)$q$, $q$queued_at    = case when attempts < 2 then now() else queued_at end,$q$, $q$queued_at    = queued_at,$q$);
