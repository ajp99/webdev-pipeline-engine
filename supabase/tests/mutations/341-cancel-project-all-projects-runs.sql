-- mutation: runs of every project are handled
select m.patch_fn($q$cancel_project(uuid, text)$q$, $q$where project_id = p_project and status in ('queued', 'running', 'waiting');$q$, $q$where status in ('queued', 'running', 'waiting');$q$);
