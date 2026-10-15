-- mutation: a client may approve an artifact at any stage
alter policy client_add_approval on approvals with check (role = 'client' and gate_type = 'client' and approved_by = auth.uid() and exists (select 1 from clients c where c.id = auth.uid() and c.is_signer));
