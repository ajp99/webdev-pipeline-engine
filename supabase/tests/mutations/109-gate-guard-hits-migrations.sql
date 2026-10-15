-- mutation: the gate_config guard also applies to migrations
select m.patch_fn($q$guard_gate_config()$q$, $q$if current_user not in ('anon', 'authenticated', 'service_role') then$q$, $q$if false then$q$);
