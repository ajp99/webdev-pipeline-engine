-- mutation: the PRD site map need not name a privacy policy
select m.patch_fn($q$private.prd_content_problem(jsonb)$q$, $q$(c -> 'sections' ->> 'site_map') !~* 'privacy' or $q$, $q$$q$);
