-- mutation: an unknown PRD section is accepted
select m.patch_fn($q$private.prd_content_problem(jsonb)$q$, $q$x <> all (keys)$q$, $q$false$q$);
