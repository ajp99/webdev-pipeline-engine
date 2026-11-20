-- mutation: a waiting run is not asked to stop
select m.patch_fn($q$cancel_project(uuid, text)$q$, $q$status in ('queued', 'running', 'waiting');$q$, $q$status in ('queued', 'running');$q$);
