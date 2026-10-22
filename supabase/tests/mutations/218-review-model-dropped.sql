-- mutation: the artifact forgets the model
select m.patch_fn($q$complete_intake_review(uuid, int, text, jsonb, jsonb, text)$q$, $q$'model', p_model,$q$, $q$'model', null,$q$);
