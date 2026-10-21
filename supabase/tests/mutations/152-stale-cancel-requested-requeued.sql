-- mutation: stale cancel requested requeued
select m.patch_fn($q$claim_run(text)$q$, $q$status = 'cancelled', finished_at = now()$q$, $q$status = 'queued', finished_at = null$q$);
