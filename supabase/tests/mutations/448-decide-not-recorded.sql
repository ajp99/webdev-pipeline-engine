-- mutation: decide-not-recorded
select m.patch_fn($q$decide_run_approval(uuid, boolean)$q$, $q$, decided_at = now(), decided_by = auth.uid()$q$, $q$$q$);
