-- mutation: one loop more than the cap
select m.patch_fn($q$feedback_gate(uuid, uuid, text, int)$q$, $q$if used >= cap then$q$, $q$if used > cap then$q$);
