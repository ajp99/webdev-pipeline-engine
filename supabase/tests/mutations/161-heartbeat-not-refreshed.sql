-- mutation: heartbeat not refreshed
select m.patch_fn($q$heartbeat_run(uuid,text)$q$, $q$set heartbeat_at = now()$q$, $q$set heartbeat_at = heartbeat_at$q$);
