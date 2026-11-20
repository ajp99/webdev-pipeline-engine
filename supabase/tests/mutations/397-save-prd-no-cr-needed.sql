-- mutation: a signed-off PRD takes a new version without a change request
select m.patch_fn($q$save_prd_version(uuid, int, jsonb, uuid)$q$, $q$if p_change_request is null then
    raise exception 'save_prd_version: the PRD is signed off; a new version needs an accepted change request';
  end if;$q$, $q$if p_change_request is null then
    insert into public.artifacts (project_id, type, version, status, content) values (p_project, 'prd', newest + 1, 'draft', p_content) returning id into art;
    return art;
  end if;$q$);
