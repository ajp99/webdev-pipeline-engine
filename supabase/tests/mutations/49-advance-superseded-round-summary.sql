-- mutation: advance_stage accepts a superseded round summary
select m.patch_fn($q$advance_stage(uuid,stage)$q$, $q$and a.status <> 'superseded' and ap.gate_type = 'soft'$q$, $q$and ap.gate_type = 'soft'$q$);
