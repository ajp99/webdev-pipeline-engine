-- mutation: feedback is stored untrimmed
select m.patch_fn($q$feedback_gate(uuid, uuid, text, int)$q$, $q$values (p_project, art.id, p_round, btrim(p_body), auth.uid());$q$, $q$values (p_project, art.id, p_round, p_body, auth.uid());$q$);
