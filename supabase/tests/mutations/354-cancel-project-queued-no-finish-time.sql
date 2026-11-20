-- mutation: a cancelled queued run gets no finish time
select m.patch_fn($q$cancel_project(uuid, text)$q$, $q$finished_at = case when status = 'queued' then now() else finished_at end$q$, $q$finished_at = finished_at$q$);
