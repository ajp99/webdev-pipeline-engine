-- mutation: finish non final status allowed
select m.patch_fn($q$finish_run(uuid,text,run_status,bigint)$q$, $q$if p_status not in ('succeeded', 'failed', 'cancelled', 'stopped') then$q$, $q$if false then$q$);
