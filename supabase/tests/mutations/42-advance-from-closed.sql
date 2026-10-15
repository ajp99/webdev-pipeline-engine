-- mutation: advance_stage moves a closed project
select m.patch_fn($q$advance_stage(uuid,stage)$q$, $q$if v.stage = 'closed' then$q$, $q$if false then$q$);
