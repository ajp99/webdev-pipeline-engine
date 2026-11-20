-- mutation: an owner version may name a model
select m.patch_fn($q$save_prd_version(uuid, int, jsonb, uuid)$q$, $q$if p_content ? 'model' then$q$, $q$if false then$q$);
