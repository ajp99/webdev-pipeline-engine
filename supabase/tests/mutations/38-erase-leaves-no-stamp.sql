-- mutation: erase_project_data does not stamp data_deleted_at
select m.patch_fn($q$erase_project_data(uuid)$q$, $q$update public.project_internal set data_deleted_at = now() where project_id = p_project;$q$, $q$null;$q$);
