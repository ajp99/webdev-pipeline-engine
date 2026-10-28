-- mutation: an intake row may change its identity
select m.patch_fn($q$guard_intake_response()$q$, $q$if tg_op = 'UPDATE' and (new.project_id$q$, $q$if false and (new.project_id$q$);
