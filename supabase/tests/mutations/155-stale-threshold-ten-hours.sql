-- mutation: stale threshold ten hours
select m.patch_fn($q$claim_run(text)$q$, $q$where status = 'running'
     and coalesce(heartbeat_at, started_at, queued_at) < now() - interval '10 minutes'$q$, $q$where status = 'running'
     and coalesce(heartbeat_at, started_at, queued_at) < now() - interval '10 hours'$q$);
