-- mutation: finish retry keeps claim
select m.patch_fn($q$finish_run(uuid,text,run_status,bigint)$q$, $q$set status = 'queued', claimed_by = null, heartbeat_at = null,$q$, $q$set status = 'queued', heartbeat_at = null,$q$);
