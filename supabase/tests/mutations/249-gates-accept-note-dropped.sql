-- mutation: accept_gate drops the evidence note
select m.patch_fn($q$accept_gate(uuid, gate_type, uuid, text, int)$q$, $q$nullif(btrim(p_note), '')$q$, $q$null$q$);
