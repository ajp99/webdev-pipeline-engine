-- mutation: accept_gate records every approval as the owner's
select m.patch_fn($q$accept_gate(uuid, gate_type, uuid, text, int)$q$, $q$values (art.id, auth.uid(), gk, p_gate, nullif(btrim(p_note), ''));$q$, $q$values (art.id, auth.uid(), 'owner', p_gate, nullif(btrim(p_note), ''));$q$);
