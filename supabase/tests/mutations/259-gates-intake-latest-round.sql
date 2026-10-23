-- mutation: the oldest intake round decides instead of the latest
select m.patch_fn($q$private.intake_blocker(uuid)$q$, $q$order by round desc limit 1;$q$, $q$order by round asc limit 1;$q$);
