-- mutation: pause-run-not-waiting
select m.patch_fn($q$request_run_approval(uuid, text, text, text)$q$, $q$update public.stage_runs set status = 'waiting', heartbeat_at = now() where stage_runs.id = p_run;$q$, $q$$q$);
