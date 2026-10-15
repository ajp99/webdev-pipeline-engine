-- mutation: close_project does not set retention_until
select m.patch_fn($q$private.close_project(uuid,public.close_reason)$q$, $q$now() + make_interval(days => retention_days)$q$, $q$null::timestamptz$q$);
