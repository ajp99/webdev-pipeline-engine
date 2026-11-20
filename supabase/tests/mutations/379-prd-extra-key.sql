-- mutation: an unknown top-level PRD key is accepted
select m.patch_fn($q$private.prd_content_problem(jsonb)$q$, $q$x not in ('sections', 'spam_protection', 'change_summary', 'model')$q$, $q$false$q$);
