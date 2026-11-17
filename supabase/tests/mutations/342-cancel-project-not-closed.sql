-- mutation: the project is not closed
select m.patch_fn($q$cancel_project(uuid, text)$q$, $q$perform private.close_project(p_project, 'cancelled');$q$, $q$null;$q$);
