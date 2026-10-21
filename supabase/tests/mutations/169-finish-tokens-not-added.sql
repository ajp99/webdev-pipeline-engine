-- mutation: finish tokens not added
select m.patch_fn($q$finish_run(uuid,text,run_status,bigint)$q$, $q$finished_at = now(), tokens_used = tokens_used + p_tokens$q$, $q$finished_at = now()$q$);
