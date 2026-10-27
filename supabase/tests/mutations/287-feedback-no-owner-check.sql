-- mutation: anyone signed in can give feedback
select m.patch_fn($q$feedback_gate(uuid, uuid, text, int)$q$, $q$if not private.is_owner() then
    raise exception 'feedback_gate: not allowed';$q$, $q$if false then
    raise exception 'feedback_gate: not allowed';$q$);
