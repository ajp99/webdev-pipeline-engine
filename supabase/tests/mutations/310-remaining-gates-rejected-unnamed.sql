-- mutation: remaining_gates hides a rejected version
select m.patch_fn($q$remaining_gates(uuid)$q$, $q$case when has_art and art.status = 'rejected' then art.id end, atype,$q$, $q$null::uuid, atype,$q$);
