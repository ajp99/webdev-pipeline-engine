-- mutation: claim ignores the stage the project is in
select m.patch_fn($q$claim_run(text)$q$, $q$and p.stage = s.stage)$q$, $q$)$q$);
