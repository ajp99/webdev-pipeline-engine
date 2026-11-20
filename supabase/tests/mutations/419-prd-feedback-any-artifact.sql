-- mutation: PRD feedback may name any artifact
select m.patch_fn($q$guard_prd_feedback()$q$, $q$and a.type = 'prd')$q$, $q$and true)$q$);
