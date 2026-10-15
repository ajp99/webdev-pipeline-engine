-- mutation: client_project_in ignores a paused project
select m.patch_fn($q$client_project_in(stage[])$q$, $q$p.status = 'active' and$q$, $q$$q$);
