-- mutation: client_project_in ignores the stage
select m.patch_fn($q$client_project_in(stage[])$q$, $q$and p.stage = any (p_stages)$q$, $q$$q$);
