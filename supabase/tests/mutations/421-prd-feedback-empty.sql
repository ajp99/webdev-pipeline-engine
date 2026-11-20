-- mutation: PRD feedback may be empty
select m.patch_fn($q$guard_prd_feedback()$q$, $q$if btrim(new.body) = '' or length(new.body) > 4000 then$q$, $q$if false then$q$);
