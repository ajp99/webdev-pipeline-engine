-- mutation: close_project is executable by the worker
grant execute on function close_project(uuid, close_reason) to service_role;
