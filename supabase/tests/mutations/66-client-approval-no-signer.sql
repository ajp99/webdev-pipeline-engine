-- mutation: a client who is not the signer may approve
alter policy client_add_approval on approvals with check (role = 'client' and gate_type = 'client' and approved_by = auth.uid());
