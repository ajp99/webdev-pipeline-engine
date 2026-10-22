-- mutation: a finished artifact is not marked approved
select m.patch_fn($q$accept_gate(uuid, gate_type, uuid, text, int)$q$, $q$  update public.artifacts set status = 'approved' where id = art.id;
  if gk = 'client' then$q$, $q$  if gk = 'client' then$q$);
