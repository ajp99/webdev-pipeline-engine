-- mutation: reject_gate does not check that the round is in review
select m.patch_fn($q$reject_gate(uuid, uuid, int)$q$, $q$if v.stage = 'build_rounds' and not exists ($q$, $q$if false and not exists ($q$);
