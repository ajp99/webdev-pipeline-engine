-- mutation: PRD feedback keeps the author the caller sent
select m.patch_fn($q$guard_prd_feedback()$q$, $q$new.created_by := auth.uid();$q$, $q$null;$q$);
