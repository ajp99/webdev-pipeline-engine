-- mutation: a client may read every approval
alter policy client_read_approvals on approvals using (true);
