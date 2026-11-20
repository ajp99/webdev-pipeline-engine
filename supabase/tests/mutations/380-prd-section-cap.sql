-- mutation: a PRD section has no size cap
select m.patch_fn($q$private.prd_content_problem(jsonb)$q$, $q$length(c -> 'sections' ->> k) > 20000$q$, $q$false$q$);
