-- mutation: the worker may add a version after the stage
select m.patch_fn($q$guard_gated_artifact_version()$q$, $q$if current_user not in ('anon', 'authenticated', 'service_role') then$q$, $q$if current_user not in ('anon', 'authenticated') then$q$);
