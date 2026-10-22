-- mutation: a submitted latest intake round does not block
select m.patch_fn($q$private.intake_blocker(uuid)$q$, $q$if found and r.status <> 'reviewed' then$q$, $q$if found and r.status = 'open' then$q$);
