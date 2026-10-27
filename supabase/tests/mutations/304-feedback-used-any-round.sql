-- mutation: loops on other rounds count
select m.patch_fn($q$private.feedback_used(uuid, public.artifact_type, int)$q$, $q$and f.round is not distinct from p_round$q$, $q$$q$);
