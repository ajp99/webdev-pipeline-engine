-- mutation: another stage's cap applies
select m.patch_fn($q$private.feedback_cap(uuid, public.stage)$q$, $q$where g.stage = p_stage and g.project_id = p_project$q$, $q$where g.project_id = p_project$q$);
