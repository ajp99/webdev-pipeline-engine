-- mutation: the owner may insert an approval for anyone
alter policy owner_add_approval on approvals with check (private.is_owner());
