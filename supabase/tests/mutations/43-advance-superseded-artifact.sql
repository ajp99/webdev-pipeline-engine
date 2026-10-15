-- mutation: advance_stage accepts a superseded artifact
select m.patch_fn($q$advance_stage(uuid,stage)$q$, $q$if not found or art.status = 'superseded' then$q$, $q$if not found then$q$);
