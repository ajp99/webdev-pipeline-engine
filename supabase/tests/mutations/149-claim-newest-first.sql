-- mutation: claim newest first
select m.patch_fn($q$claim_run(text)$q$, $q$order by s.queued_at, s.id$q$, $q$order by s.queued_at desc, s.id$q$);
