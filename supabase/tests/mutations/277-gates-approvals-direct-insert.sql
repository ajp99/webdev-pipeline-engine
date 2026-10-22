-- mutation: the owner may write approval rows directly again
create policy owner_add_approval on approvals for insert to authenticated with check (private.is_owner() and approved_by = auth.uid());
