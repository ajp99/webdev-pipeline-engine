-- mutation: finish role check dropped
select m.patch_fn($q$finish_run(uuid,text,run_status,bigint)$q$, $q$if auth.role() is distinct from 'service_role' then$q$, $q$if false then$q$);
