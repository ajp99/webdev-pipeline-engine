-- mutation: end_run does not mark the run
select m.patch_fn($q$end_run(uuid)$q$, $q$update public.stage_runs set ended_at = now() where id = r.id;$q$, $q$null;$q$);
