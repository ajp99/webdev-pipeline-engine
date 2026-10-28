-- mutation: a project's own cap is ignored
select m.patch_fn($q$private.feedback_cap(uuid, public.stage)$q$, $q$where g.stage = p_stage and g.project_id = p_project and g.feedback_cap is not null$q$, $q$where false$q$);
