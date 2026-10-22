-- mutation: a review is accepted for a paused project or a stage past intake
select m.patch_fn($q$complete_intake_review(uuid, int, text, jsonb, jsonb, text)$q$, $q$if proj.status <> 'active' or proj.stage <> 'intake' then$q$, $q$if false then$q$);
