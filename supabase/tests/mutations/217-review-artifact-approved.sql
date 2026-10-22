-- mutation: the review is stored as approved, not draft
select m.patch_fn($q$complete_intake_review(uuid, int, text, jsonb, jsonb, text)$q$, $q$'draft',$q$, $q$'approved',$q$);
