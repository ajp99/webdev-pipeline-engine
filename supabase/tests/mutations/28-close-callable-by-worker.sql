-- mutation: close_project is executable by the worker
grant execute on function private.close_project(uuid, public.close_reason) to service_role;
