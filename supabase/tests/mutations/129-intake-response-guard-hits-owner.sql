-- mutation: the intake response guard also stops the owner
select m.patch_fn($q$guard_intake_response_update()$q$, $q$not (private.is_owner() or private.is_service_role())$q$, $q$true$q$);
