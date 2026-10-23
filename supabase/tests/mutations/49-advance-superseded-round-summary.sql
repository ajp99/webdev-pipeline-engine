-- mutation: advance_stage accepts a superseded round summary
select m.patch_fn($q$private.advance_blocker(uuid)$q$, $q$and a.status not in ('superseded', 'rejected') and ap.gate_type = 'soft'$q$, $q$and ap.gate_type = 'soft'$q$);
