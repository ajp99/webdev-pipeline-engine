-- mutation: the stage guard ignores the advance_stage flag
select m.patch_fn($q$guard_stage_change()$q$, $q$and coalesce(current_setting('app.stage_advance', true), '') <> 'on'$q$, $q$and false$q$);
