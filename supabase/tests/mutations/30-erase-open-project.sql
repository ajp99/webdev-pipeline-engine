-- mutation: erase_project_data runs on a project that is not closed
select m.patch_fn($q$erase_project_data(uuid)$q$, $q$if not exists (select 1 from public.projects where id = p_project and status = 'closed') then$q$, $q$if false then$q$);
