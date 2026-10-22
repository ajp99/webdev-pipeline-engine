-- mutation: a gap may carry extra keys
select m.patch_fn($q$complete_intake_review(uuid, int, text, jsonb, jsonb, text)$q$, $q$k not in ('issue', 'question_id')$q$, $q$false$q$);
