-- mutation: a global gate default can be deleted
select m.patch_fn($q$guard_gate_config()$q$, $q$raise exception 'a global gate default cannot be deleted';$q$, $q$null;$q$);
