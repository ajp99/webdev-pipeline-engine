-- mutation: the reason is not stored
select m.patch_fn($q$cancel_project(uuid, text)$q$, $q$update public.project_internal set cancel_reason = why where project_id = p_project;$q$, $q$null;$q$);
