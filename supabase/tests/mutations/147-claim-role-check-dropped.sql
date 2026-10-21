-- mutation: claim role check dropped
select m.patch_fn($q$claim_run(text)$q$, $q$if auth.role() is distinct from 'service_role' then$q$, $q$if false then$q$);
