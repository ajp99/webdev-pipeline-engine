-- mutation: cancel_project accepts an empty reason
select m.patch_fn($q$cancel_project(uuid, text)$q$, $q$if why = '' then$q$, $q$if false then$q$);
