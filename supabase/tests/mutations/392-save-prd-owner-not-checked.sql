-- mutation: save_prd_version skips the owner check
select m.patch_fn($q$save_prd_version(uuid, int, jsonb, uuid)$q$, $q$if not private.is_owner() then$q$, $q$if false then$q$);
