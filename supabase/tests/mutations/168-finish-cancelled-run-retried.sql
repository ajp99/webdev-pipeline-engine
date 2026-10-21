-- mutation: finish cancelled run retried
select m.patch_fn($q$finish_run(uuid,text,run_status,bigint)$q$, $q$if p_status = 'failed' and r.status = 'cancel_requested' then$q$, $q$if false then$q$);
