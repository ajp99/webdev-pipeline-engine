-- mutation: another project's cap applies
select m.patch_fn($q$private.feedback_cap(uuid, public.stage)$q$, $q$and g.project_id = p_project and$q$, $q$and g.project_id is not null and$q$);
