-- mutation: accepting a round leaves its claims uncleared
select m.patch_fn($q$accept_gate(uuid, public.gate_type, uuid, text, int)$q$, $q$set status = 'approved', claims_cleared_at = now() where$q$, $q$set status = 'approved' where$q$);
