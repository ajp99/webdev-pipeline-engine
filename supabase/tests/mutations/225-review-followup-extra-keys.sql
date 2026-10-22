-- mutation: a follow-up may carry extra keys
select m.patch_fn($q$complete_intake_review(uuid, int, text, jsonb, jsonb, text)$q$, $q$k not in ('id', 'text', 'reason')$q$, $q$false$q$);
