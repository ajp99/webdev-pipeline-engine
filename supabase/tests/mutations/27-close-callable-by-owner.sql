-- mutation: close_project is executable by the owner
grant execute on function close_project(uuid, close_reason) to authenticated;
