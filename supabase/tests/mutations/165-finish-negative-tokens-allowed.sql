-- mutation: finish negative tokens allowed
select m.patch_fn($q$finish_run(uuid,text,run_status,bigint)$q$, $q$if p_tokens < 0 then$q$, $q$if false then$q$);
