-- mutation: a security-definer helper searches public
alter function private.is_owner() set search_path = public;
