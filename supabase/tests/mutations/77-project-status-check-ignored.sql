-- mutation: client_project_in ignores a paused project
select m.patch_fn($q$private.client_project_in(public.stage[])$q$, $q$p.status = 'active' and$q$, $q$$q$);
