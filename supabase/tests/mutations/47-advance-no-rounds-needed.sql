-- mutation: advance_stage leaves build rounds with no rounds
select m.patch_fn($q$advance_stage(uuid,stage)$q$, $q$if not exists (select 1 from public.rounds where project_id = p_project and change_request_id is null) then$q$, $q$if false then$q$);
