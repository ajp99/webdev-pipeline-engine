-- mutation: a client may change reviewed_at
select m.patch_fn($q$guard_intake_round_client_update()$q$, $q$(new.id, new.project_id, new.round, new.reviewed_at)$q$, $q$(new.id, new.project_id, new.round)$q$);
