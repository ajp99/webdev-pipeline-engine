-- mutation: cancel_project does not check for an owner
select m.patch_fn($q$cancel_project(uuid, text)$q$, $q$if not private.is_owner() then$q$, $q$if false then$q$);
