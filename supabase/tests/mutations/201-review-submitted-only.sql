-- mutation: a round that is not submitted can be reviewed
select m.patch_fn($q$complete_intake_review(uuid, int, text, jsonb, jsonb, text)$q$, $q$if rnd.status <> 'submitted' then$q$, $q$if false then$q$);
