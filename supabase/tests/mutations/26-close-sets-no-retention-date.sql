-- mutation: close_project does not set retention_until
select m.patch_fn($q$close_project(uuid,close_reason)$q$, $q$now() + make_interval(days => retention_days)$q$, $q$null::timestamptz$q$);
