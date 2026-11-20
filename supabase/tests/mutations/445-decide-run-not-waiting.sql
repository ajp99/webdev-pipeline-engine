-- mutation: decide-run-not-waiting
select m.patch_fn($q$decide_run_approval(uuid, boolean)$q$, $q$where id = a.run_id and status = 'waiting' for update$q$, $q$where id = a.run_id for update$q$);
