-- mutation: loops on other types count
select m.patch_fn($q$private.feedback_used(uuid, public.artifact_type, int)$q$, $q$and a.type = p_type$q$, $q$$q$);
