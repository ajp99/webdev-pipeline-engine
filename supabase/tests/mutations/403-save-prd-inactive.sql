-- mutation: save_prd_version allows a paused project
select m.patch_fn($q$save_prd_version(uuid, int, jsonb, uuid)$q$, $q$if proj.status <> 'active' then$q$, $q$if false then$q$);
