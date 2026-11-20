-- mutation: end_run does not check for an owner
select m.patch_fn($q$end_run(uuid)$q$, $q$if not private.is_owner() then$q$, $q$if false then$q$);
