-- mutation: a change request that is not accepted allows a version
select m.patch_fn($q$save_prd_version(uuid, int, jsonb, uuid)$q$, $q$if cr.status <> 'accepted' or cr.decision is distinct from 'accept_current_round' then$q$, $q$if false then$q$);
