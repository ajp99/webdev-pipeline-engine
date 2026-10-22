-- mutation: a gap issue may be huge
select m.patch_fn($q$complete_intake_review(uuid, int, text, jsonb, jsonb, text)$q$, $q$length(g->>'issue') > 1100$q$, $q$length(g->>'issue') > 110000$q$);
