-- mutation: is_service_role() returns true for everybody
select m.patch_fn($q$is_service_role()$q$, $q$select coalesce(auth.role() = 'service_role', false)$q$, $q$select true$q$);
