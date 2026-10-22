-- mutation: a later gate does not start waiting after the earlier approval
select m.patch_fn($q$remaining_gates(uuid)$q$, $q$s := greatest(s, t);$q$, $q$s := s;$q$);
