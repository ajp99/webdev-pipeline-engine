-- mutation: advance_blocker ignores an accepted change request that is not deployed
select m.patch_fn($q$private.advance_blocker(uuid)$q$, $q$c.status = 'accepted'$q$, $q$false$q$);
