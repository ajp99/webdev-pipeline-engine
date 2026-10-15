-- mutation: erase_project_data leaves email log rows
select m.patch_fn($q$erase_project_data(uuid)$q$, $q$delete from public.email_log where project_id = p_project;$q$, $q$null;$q$);
