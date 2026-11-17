-- mutation: cancel_project can be called by anon
grant execute on function cancel_project(uuid, text) to anon;
