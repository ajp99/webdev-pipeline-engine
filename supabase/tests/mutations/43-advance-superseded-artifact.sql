-- mutation: advance_stage accepts a superseded artifact
select m.patch_fn($q$private.advance_blocker(uuid)$q$, $q$if not found or art.status in ('superseded', 'rejected') then$q$, $q$if not found then$q$);
