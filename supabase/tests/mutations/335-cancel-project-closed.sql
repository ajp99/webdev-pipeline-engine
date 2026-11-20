-- mutation: a closed project can be cancelled again
select m.patch_fn($q$cancel_project(uuid, text)$q$, $q$if v.status = 'closed' then$q$, $q$if false then$q$);
