-- mutation: the artifact never says the cap was reached
select m.patch_fn($q$complete_intake_review(uuid, int, text, jsonb, jsonb, text)$q$, $q$'capped', p_round >= 4$q$, $q$'capped', false$q$);
