-- mutation: claim paused project allowed
select m.patch_fn($q$claim_run(text)$q$, $q$exists (select 1 from public.projects p where p.id = s.project_id and p.status = 'active')$q$, $q$true$q$);
