-- mutation: blank feedback reaches the table
select m.patch_fn($q$feedback_gate(uuid, uuid, text, int)$q$, $q$if btrim(coalesce(p_body, '')) = '' then$q$, $q$if false then$q$);
