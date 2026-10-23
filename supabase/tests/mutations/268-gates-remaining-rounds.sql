-- mutation: rounds still being built are listed
select m.patch_fn($q$remaining_gates(uuid)$q$, $q$r.status = 'in_review' order by r.number loop$q$, $q$r.status in ('in_review', 'building') order by r.number loop$q$);
