-- mutation: a gate with no artifact is shown as missing
select m.patch_fn($q$remaining_gates(uuid)$q$, $q$'waiting', null::timestamptz, null::timestamptz, false, false;$q$, $q$'missing', null::timestamptz, null::timestamptz, false, false;$q$);
