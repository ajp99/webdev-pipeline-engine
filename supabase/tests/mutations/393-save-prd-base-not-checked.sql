-- mutation: save_prd_version ignores a stale base version
select m.patch_fn($q$save_prd_version(uuid, int, jsonb, uuid)$q$, $q$if p_base_version is distinct from newest then$q$, $q$if false then$q$);
