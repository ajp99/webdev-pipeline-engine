-- mutation: claim attempts not counted
select m.patch_fn($q$claim_run(text)$q$, $q$attempts = attempts + 1$q$, $q$attempts = attempts$q$);
