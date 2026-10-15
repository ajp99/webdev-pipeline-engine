-- mutation: updated_at is not refreshed on change
select m.patch_fn($q$guard_intake_response_update()$q$, $q$new.updated_at := now();$q$, $q$null;$q$);
