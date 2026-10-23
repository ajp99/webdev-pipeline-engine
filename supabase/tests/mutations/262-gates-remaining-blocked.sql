-- mutation: a gate behind another is shown as missing
select m.patch_fn($q$remaining_gates(uuid)$q$, $q$case when pending then 'blocked' else 'missing' end$q$, $q$'missing'$q$);
