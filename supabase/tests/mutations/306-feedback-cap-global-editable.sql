-- mutation: the owner can change a global cap
select m.patch_fn($q$guard_gate_config()$q$, $q$if old.project_id is null and new.feedback_cap is distinct from old.feedback_cap then$q$, $q$if false then$q$);
