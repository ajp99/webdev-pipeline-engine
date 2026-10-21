-- mutation: enqueue owner check dropped
select m.patch_fn($q$enqueue_run(uuid,stage)$q$, $q$if not (private.is_owner() or auth.role() = 'service_role') then$q$, $q$if false then$q$);
