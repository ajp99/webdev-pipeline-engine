-- mutation: a follow-up id of any shape is accepted
select m.patch_fn($q$complete_intake_review(uuid, int, text, jsonb, jsonb, text)$q$, $q$or coalesce(f->>'id', '') !~ ('^fu' || (p_round + 1) || '_[0-9]+$')$q$, $q$$q$);
