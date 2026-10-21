-- mutation: stale waiting requeued
select m.patch_fn($q$claim_run(text)$q$, $q$where status = 'running'
     and coalesce(heartbeat_at, started_at, queued_at)$q$, $q$where status in ('running', 'waiting')
     and coalesce(heartbeat_at, started_at, queued_at)$q$);
