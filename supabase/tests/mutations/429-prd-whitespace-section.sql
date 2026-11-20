-- mutation: a section of only whitespace counts as text
select m.patch_fn($q$private.prd_content_problem(jsonb)$q$, $q$(c -> 'sections' ->> k) !~ '\S'$q$, $q$btrim(c -> 'sections' ->> k) = ''$q$);
