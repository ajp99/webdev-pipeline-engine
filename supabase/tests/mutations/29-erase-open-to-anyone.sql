-- mutation: erase_project_data has no role check
select m.patch_fn($q$erase_project_data(uuid)$q$, $q$if not (private.is_owner() or private.is_service_role()) then$q$, $q$if false then$q$);
