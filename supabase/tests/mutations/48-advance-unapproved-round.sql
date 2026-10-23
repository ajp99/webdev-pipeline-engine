-- mutation: advance_stage ignores a round that is not approved
select m.patch_fn($q$private.advance_blocker(uuid)$q$, $q$r.status <> 'approved'$q$, $q$false$q$);
