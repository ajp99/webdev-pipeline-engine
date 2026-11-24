-- mutation: decide-twice
select m.patch_fn($q$decide_run_approval(uuid, boolean)$q$, $q$a.status <> 'pending'$q$, $q$false$q$);
