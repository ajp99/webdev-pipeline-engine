-- mutation: reject_gate works in a paused project
select m.patch_fn($q$reject_gate(uuid, uuid, int)$q$, $q$if v.status <> 'active' then$q$, $q$if false then$q$);
