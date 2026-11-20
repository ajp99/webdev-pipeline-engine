-- mutation: the PRD site map need not name a cookie notice
select m.patch_fn($q$private.prd_content_problem(jsonb)$q$, $q$ or (c -> 'sections' ->> 'site_map') !~* 'cookie'$q$, $q$$q$);
