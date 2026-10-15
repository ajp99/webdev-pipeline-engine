-- mutation: close_project is executable by the owner
grant execute on function private.close_project(uuid, public.close_reason) to authenticated;
