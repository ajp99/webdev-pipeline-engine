-- mutation: erase_project_data leaves uploads rows
select m.patch_fn($q$erase_project_data(uuid)$q$, $q$delete from public.uploads where project_id = p_project;$q$, $q$null;$q$);
