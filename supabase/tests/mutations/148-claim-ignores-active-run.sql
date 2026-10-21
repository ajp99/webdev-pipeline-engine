-- mutation: claim ignores active run
select m.patch_fn($q$claim_run(text)$q$, $q$where a.project_id = s.project_id and a.status in ('running', 'waiting', 'cancel_requested')$q$, $q$where false$q$);
