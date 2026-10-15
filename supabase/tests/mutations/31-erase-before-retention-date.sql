-- mutation: erase_project_data runs before the retention date
select m.patch_fn($q$erase_project_data(uuid)$q$, $q$if i.retention_until is null or i.retention_until > now() then$q$, $q$if false then$q$);
