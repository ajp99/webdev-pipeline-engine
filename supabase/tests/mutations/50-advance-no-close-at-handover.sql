-- mutation: advance_stage does not close the project after handover
select m.patch_fn($q$advance_stage(uuid,stage)$q$, $q$perform public.close_project(p_project, 'completed');$q$, $q$null;$q$);
