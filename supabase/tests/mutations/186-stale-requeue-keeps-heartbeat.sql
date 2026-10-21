-- mutation: stale requeue keeps heartbeat
select m.patch_fn($q$claim_run(text)$q$, $q$heartbeat_at = case when attempts < 2 then null else heartbeat_at end,$q$, $q$heartbeat_at = heartbeat_at,$q$);
