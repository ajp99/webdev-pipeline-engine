-- mutation: a client-gate record needs no evidence note
alter table approvals drop constraint client_approval_needs_evidence;
