-- mutation: a global gate default can be added
select m.patch_fn($q$guard_gate_config()$q$, $q$raise exception 'a global gate default changes only through a migration';$q$, $q$null;$q$);
