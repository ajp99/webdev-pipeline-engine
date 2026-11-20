-- mutation: a change request allows more than one version
select m.patch_fn($q$save_prd_version(uuid, int, jsonb, uuid)$q$, $q$if exists (select 1 from public.artifacts where change_request_id = cr.id and type = 'prd') then$q$, $q$if false then$q$);
