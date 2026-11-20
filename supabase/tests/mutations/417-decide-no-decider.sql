-- mutation: the decider is not recorded
select m.patch_fn($q$decide_change_request(uuid, public.change_decision, text)$q$, $q$decided_by = auth.uid()$q$, $q$decided_by = null$q$);
