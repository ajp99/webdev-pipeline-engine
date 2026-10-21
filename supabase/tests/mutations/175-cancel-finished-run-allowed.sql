-- mutation: cancel finished run allowed
select m.patch_fn($q$request_run_cancel(uuid)$q$, $q$raise exception 'request_run_cancel: the run is already %', r.status;$q$, $q$final := r.status;$q$);
