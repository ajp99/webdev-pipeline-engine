-- mutation: accept_gate leaves a queued run of the old stage in place
select m.patch_fn($q$accept_gate(uuid, gate_type, uuid, text, int)$q$, $q$perform public.request_run_cancel(g.id);$q$, $q$null;$q$);
