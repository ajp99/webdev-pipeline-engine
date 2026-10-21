-- mutation: stale requeue keeps claim
select m.patch_fn($q$claim_run(text)$q$, $q$claimed_by   = case when attempts < 2 then null else claimed_by end,$q$, $q$claimed_by   = claimed_by,$q$);
