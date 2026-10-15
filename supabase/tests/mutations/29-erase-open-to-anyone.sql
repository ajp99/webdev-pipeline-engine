-- mutation: erase_project_data has no role check
select m.patch_fn($q$erase_project_data(uuid)$q$, $q$if not (public.is_owner() or public.is_service_role()) then$q$, $q$if false then$q$);
