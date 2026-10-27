-- mutation: feedback has no length cap
alter table gate_feedback drop constraint gate_feedback_body;
alter table gate_feedback add constraint gate_feedback_body check (btrim(body) <> '');
