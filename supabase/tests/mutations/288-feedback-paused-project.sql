-- mutation: a paused project gets feedback
select m.patch_fn($q$feedback_gate(uuid, uuid, text, int)$q$, $q$if v.status <> 'active' then$q$, $q$if false then$q$);
