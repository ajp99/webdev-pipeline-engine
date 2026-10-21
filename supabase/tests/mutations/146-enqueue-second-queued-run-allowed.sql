-- mutation: enqueue second queued run allowed
select m.patch_fn($q$enqueue_run(uuid,stage)$q$, $q$if exists (select 1 from public.stage_runs where project_id = p_project and status = 'queued') then$q$, $q$if false then$q$);
