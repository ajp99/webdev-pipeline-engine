-- mutation: advance_stage moves a paused project
select m.patch_fn($q$advance_stage(uuid,stage)$q$, $q$if v.status <> 'active' then$q$, $q$if false then$q$);
