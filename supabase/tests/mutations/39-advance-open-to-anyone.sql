-- mutation: advance_stage has no owner check
select m.patch_fn($q$advance_stage(uuid,stage)$q$, $q$if not public.is_owner() then$q$, $q$if false then$q$);
