-- mutation: a change request is accepted before the sign-off
select m.patch_fn($q$save_prd_version(uuid, int, jsonb, uuid)$q$, $q$if p_change_request is not null then
      raise exception$q$, $q$if false then
      raise exception$q$);
