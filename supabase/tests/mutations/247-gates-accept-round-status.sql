-- mutation: an accepted round is not marked approved
select m.patch_fn($q$accept_gate(uuid, gate_type, uuid, text, int)$q$, $q$update public.rounds set status = 'approved' where project_id = p_project and number = p_round;$q$, $q$null;$q$);
