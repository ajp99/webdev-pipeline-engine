-- mutation: pause-other-worker
select m.patch_fn($q$request_run_approval(uuid, text, text, text)$q$, $q$r.claimed_by is distinct from p_worker or $q$, $q$$q$);
