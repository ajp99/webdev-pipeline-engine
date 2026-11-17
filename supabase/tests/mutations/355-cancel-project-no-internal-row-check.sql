-- mutation: a missing internal row is not noticed
select m.patch_fn($q$cancel_project(uuid, text)$q$, $q$if not found then
    raise exception 'cancel_project: the project has no internal row';
  end if;$q$, $q$null;$q$);
