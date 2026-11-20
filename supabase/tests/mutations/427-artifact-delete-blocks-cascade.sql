-- mutation: the delete guard also blocks a project's cascade
select m.patch_fn($q$guard_artifact_delete()$q$, $q$if pg_trigger_depth() = 1 and current_user$q$, $q$if current_user$q$);
-- (run as the API role too: the cascade test deletes as postgres, so make the guard refuse every role)
select m.patch_fn($q$guard_artifact_delete()$q$, $q$current_user in ('authenticated', 'service_role', 'anon')$q$, $q$true$q$);
