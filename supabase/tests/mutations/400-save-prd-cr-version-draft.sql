-- mutation: a change-request version is left as a draft
select m.patch_fn($q$save_prd_version(uuid, int, jsonb, uuid)$q$, $q$values (p_project, 'prd', newest + 1, 'approved', p_content, cr.id)$q$, $q$values (p_project, 'prd', newest + 1, 'draft', p_content, cr.id)$q$);
