-- mutation: erase_project_data leaves intake answers
select m.patch_fn($q$erase_project_data(uuid)$q$, $q$delete from intake_responses where project_id = p_project;$q$, $q$null;$q$);
