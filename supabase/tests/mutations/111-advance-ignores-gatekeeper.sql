-- mutation: advance_stage accepts an approval in any role
select m.patch_fn($q$advance_stage(uuid,stage)$q$, $q$and ap.gate_type = gt and ap.role = gk$q$, $q$and ap.gate_type = gt$q$);
