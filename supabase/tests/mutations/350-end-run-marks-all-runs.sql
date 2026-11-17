-- mutation: end_run marks every run of the project
select m.patch_fn($q$end_run(uuid)$q$, $q$set ended_at = now() where id = r.id;$q$, $q$set ended_at = now() where project_id = r.project_id and status in ('failed', 'stopped');$q$);
