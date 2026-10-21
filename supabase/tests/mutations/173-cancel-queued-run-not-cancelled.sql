-- mutation: cancel queued run not cancelled
select m.patch_fn($q$request_run_cancel(uuid)$q$, $q$if r.status = 'queued' then$q$, $q$if false then$q$);
