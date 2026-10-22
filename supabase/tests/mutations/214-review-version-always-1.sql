-- mutation: every review is artifact version 1
select m.patch_fn($q$complete_intake_review(uuid, int, text, jsonb, jsonb, text)$q$, $q$coalesce((select max(version) from public.artifacts where project_id = p_project and type = 'intake_record'), 0) + 1$q$, $q$1$q$);
