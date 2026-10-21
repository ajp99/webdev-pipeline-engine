-- mutation: heartbeat role check dropped
select m.patch_fn($q$heartbeat_run(uuid,text)$q$, $q$if auth.role() is distinct from 'service_role' then$q$, $q$if false then$q$);
