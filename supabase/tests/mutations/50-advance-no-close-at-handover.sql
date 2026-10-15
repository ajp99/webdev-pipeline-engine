-- mutation: advance_stage does not close the project after handover
select m.patch_fn($q$advance_stage(uuid,stage)$q$, $q$perform private.close_project(p_project, 'completed');$q$, $q$null;$q$);
