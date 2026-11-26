-- mutation: rejecting a round leaves it in review with its branch
select m.patch_fn($q$reject_gate(uuid, uuid, int)$q$, $q$update public.rounds set status = 'planned', branch = null where project_id = p_project and number = p_round;$q$, $q$null;$q$);
