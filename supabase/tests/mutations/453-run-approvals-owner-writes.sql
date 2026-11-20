-- mutation: the owner may write pause requests directly, around decide_run_approval
create policy owner_write on run_approvals for all to authenticated using (private.is_owner()) with check (private.is_owner());
