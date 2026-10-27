-- mutation: the owner may write feedback rows directly
grant insert on gate_feedback to authenticated;
create policy owner_add_feedback on gate_feedback for insert to authenticated with check (private.is_owner());
