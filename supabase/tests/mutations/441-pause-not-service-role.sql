-- mutation: anyone signed in may record a pause request (both layers removed: the role check and the grant)
select m.patch_fn($q$request_run_approval(uuid, text, text, text)$q$, $q$auth.role() is distinct from 'service_role'$q$, $q$false$q$);
grant execute on function request_run_approval(uuid, text, text, text) to authenticated;
