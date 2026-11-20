-- mutation: a change request is recorded before the sign-off
select m.patch_fn($q$guard_change_request()$q$, $q$if array_position(enum_range(null::public.stage), proj.stage) <= array_position(enum_range(null::public.stage), 'requirements'::public.stage) then$q$, $q$if false then$q$);
