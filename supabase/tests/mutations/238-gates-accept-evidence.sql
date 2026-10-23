-- mutation: accept_gate takes a client approval without a note
select m.patch_fn($q$accept_gate(uuid, gate_type, uuid, text, int)$q$, $q$if gk = 'client' and btrim(coalesce(p_note, '')) = '' then$q$, $q$if false then$q$);
