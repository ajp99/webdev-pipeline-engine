-- mutation: enqueue paused project allowed
select m.patch_fn($q$enqueue_run(uuid,stage)$q$, $q$if v.status <> 'active' then$q$, $q$if false then$q$);
