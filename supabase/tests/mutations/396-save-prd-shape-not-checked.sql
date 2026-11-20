-- mutation: save_prd_version skips the PRD shape check
select m.patch_fn($q$save_prd_version(uuid, int, jsonb, uuid)$q$, $q$problem := private.prd_content_problem(p_content);$q$, $q$problem := null;$q$);
