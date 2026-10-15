-- mutation: erase_project_data leaves run logs
select m.patch_fn($q$erase_project_data(uuid)$q$, $q$delete from run_logs where run_id in (select id from stage_runs where project_id = p_project);$q$, $q$null;$q$);
