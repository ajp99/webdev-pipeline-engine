-- mutation: claim exhausted queued run left in queue
select m.patch_fn($q$claim_run(text)$q$, $q$where status = 'queued' and attempts >= 2;$q$, $q$where false;$q$);
