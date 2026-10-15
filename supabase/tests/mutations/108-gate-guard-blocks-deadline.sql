-- mutation: a gate row cannot even change its deadline
select m.patch_fn($q$guard_gate_config()$q$, $q$if (new.id, new.stage, new.project_id, new.gate_type, new.gatekeeper)$q$, $q$if true or (new.id, new.stage, new.project_id, new.gate_type, new.gatekeeper)$q$);
