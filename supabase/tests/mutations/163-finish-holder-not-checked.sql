-- mutation: finish holder not checked
select m.patch_fn($q$finish_run(uuid,text,run_status,bigint)$q$, $q$where id = p_run and claimed_by = p_worker and status in$q$, $q$where id = p_run and status in$q$);
