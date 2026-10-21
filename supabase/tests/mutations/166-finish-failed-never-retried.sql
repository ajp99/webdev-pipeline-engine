-- mutation: finish failed never retried
select m.patch_fn($q$finish_run(uuid,text,run_status,bigint)$q$, $q$elsif p_status = 'failed' and r.attempts < 2 then$q$, $q$elsif false then$q$);
