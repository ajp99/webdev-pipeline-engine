-- mutation: the artifact does not record the round
select m.patch_fn($q$complete_intake_review(uuid, int, text, jsonb, jsonb, text)$q$, $q$'round', p_round, $q$, $q$$q$);
