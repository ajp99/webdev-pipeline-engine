-- mutation: a blank evidence note is accepted
alter table approvals drop constraint client_approval_needs_evidence; alter table approvals add constraint client_approval_needs_evidence check (role <> 'client' or evidence_note is not null);
