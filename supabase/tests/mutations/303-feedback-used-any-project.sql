-- mutation: loops in other projects count
select m.patch_fn($q$private.feedback_used(uuid, public.artifact_type, int)$q$, $q$where f.project_id = p_project and$q$, $q$where$q$);
