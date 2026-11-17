-- mutation: the length of the reason is not checked by the function
select m.patch_fn($q$cancel_project(uuid, text)$q$, $q$if length(why) > 2000 then$q$, $q$if false then$q$);
