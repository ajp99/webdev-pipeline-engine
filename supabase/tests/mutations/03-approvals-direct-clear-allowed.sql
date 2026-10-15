-- mutation: a direct update may clear approved_by (trigger depth not required)
select m.patch_fn($q$guard_approval_change()$q$, $q$pg_trigger_depth() > 1$q$, $q$true$q$);
