-- mutation: the owner may save a PRD version while a requirements run is drafting
select m.patch_fn($q$save_prd_version(uuid, int, jsonb, uuid)$q$, $q$if exists (select 1 from public.stage_runs where project_id = p_project and stage = 'requirements'$q$, $q$if false and exists (select 1 from public.stage_runs where project_id = p_project and stage = 'requirements'$q$);
