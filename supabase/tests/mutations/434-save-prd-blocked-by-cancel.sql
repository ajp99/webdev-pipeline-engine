-- mutation: a run already asked to cancel still blocks the owner's save
select m.patch_fn($q$save_prd_version(uuid, int, jsonb, uuid)$q$, $q$and status in ('queued', 'running', 'waiting')) then$q$, $q$and status in ('queued', 'running', 'waiting', 'cancel_requested')) then$q$);
