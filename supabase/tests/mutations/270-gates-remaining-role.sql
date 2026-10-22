-- mutation: an approval in the wrong role satisfies the gate
select m.patch_fn($q$remaining_gates(uuid)$q$, $q$and ap.role = g.gatekeeper$q$, $q$and true$q$);
