-- mutation: ids may start at 0 or have leading zeros
select m.patch_fn($q$complete_intake_review(uuid, int, text, jsonb, jsonb, text)$q$, $q$'_[1-9][0-9]*$')$q$, $q$'_[0-9]+$')$q$);
