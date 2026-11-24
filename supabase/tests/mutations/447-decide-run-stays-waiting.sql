-- mutation: decide-run-stays-waiting
select m.patch_fn($q$decide_run_approval(uuid, boolean)$q$, $q$update public.stage_runs set status = 'running' where id = a.run_id and status = 'waiting';$q$, $q$$q$);
