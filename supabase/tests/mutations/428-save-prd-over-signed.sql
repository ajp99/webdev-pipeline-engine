-- mutation: the owner may replace a signed-off PRD in the requirements stage
select m.patch_fn($q$save_prd_version(uuid, int, jsonb, uuid)$q$, $q$if exists (select 1 from public.artifacts where project_id = p_project and type = 'prd' and version = newest and status = 'approved') then$q$, $q$if false then$q$);
