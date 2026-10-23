-- mutation: advance_stage reads the global gatekeeper before the project's
select m.patch_fn($q$private.advance_blocker(uuid)$q$, $q$order by g.project_id nulls last limit 1;$q$, $q$order by g.project_id nulls first limit 1;$q$);
