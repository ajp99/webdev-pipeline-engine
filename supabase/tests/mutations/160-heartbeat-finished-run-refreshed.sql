-- mutation: heartbeat finished run refreshed
select m.patch_fn($q$heartbeat_run(uuid,text)$q$, $q$and status in ('running', 'waiting', 'cancel_requested')$q$, $q$and true$q$);
